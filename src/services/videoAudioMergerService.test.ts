/**
 * Unit Tests for VideoAudioMergerService
 *
 * Tests all functionality with mocked Tauri APIs.
 * Target: >80% coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { videoAudioMergerService, MergeError } from './videoAudioMergerService';
import type { MergeOptions, MergeResult } from './videoAudioMergerService';

// MARK: - Mocks

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
}));

// Mock @tauri-apps/api (for path utilities)
vi.mock('@tauri-apps/api', () => ({
  path: {
    isAbsolute: vi.fn(),
    appDataDir: vi.fn(),
    join: vi.fn(),
    dirname: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
import { exists } from '@tauri-apps/plugin-fs';
import { path } from '@tauri-apps/api';

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockExists = exists as ReturnType<typeof vi.fn>;
const mockIsAbsolute = path.isAbsolute as ReturnType<typeof vi.fn>;
const mockAppDataDir = path.appDataDir as ReturnType<typeof vi.fn>;
const mockJoin = path.join as ReturnType<typeof vi.fn>;
const mockDirname = path.dirname as ReturnType<typeof vi.fn>;

function setupHappyPathMocks() {
  // Path validation mocks
  mockIsAbsolute.mockResolvedValue(true);
  mockExists.mockResolvedValue(true);

  // Path generation mocks
  mockAppDataDir.mockResolvedValue('/Users/test/AppData');
  mockJoin.mockImplementation(async (...parts: string[]) => parts.join('/'));
  mockDirname.mockImplementation(async (p: string) => p.split('/').slice(0, -1).join('/'));

  // Merge result mock
  mockInvoke.mockResolvedValue({
    output_path: '/Users/test/AppData/videos/session-123-optimized.mp4',
    duration: 30.5,
    file_size: 1024000,
    compression_ratio: 0.6,
  });
}

describe('VideoAudioMergerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = videoAudioMergerService;
      const instance2 = videoAudioMergerService;
      expect(instance1).toBe(instance2);
    });
  });

  describe('mergeVideoAndAudio - Happy Path', () => {
    it('should merge video and audio successfully', async () => {
      setupHappyPathMocks();

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
        compressionQuality: 'medium',
      };

      const result = await videoAudioMergerService.mergeVideoAndAudio(options);

      expect(result).toEqual({
        success: true,
        outputPath: '/Users/test/AppData/videos/session-123-optimized.mp4',
        duration: 30.5,
        fileSize: 1024000,
        compressionRatio: 0.6,
      });

      // Verify Tauri command was called
      expect(mockInvoke).toHaveBeenCalledWith('merge_video_and_audio', {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
        outputPath: expect.any(String),
        quality: 'medium',
      });
    });

    it('should use default quality if not provided', async () => {
      setupHappyPathMocks();

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      await videoAudioMergerService.mergeVideoAndAudio(options);

      expect(mockInvoke).toHaveBeenCalledWith(
        'merge_video_and_audio',
        expect.objectContaining({
          quality: 'medium', // default
        })
      );
    });

    it('should use provided output path if given', async () => {
      setupHappyPathMocks();

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
        outputPath: '/custom/output.mp4',
      };

      await videoAudioMergerService.mergeVideoAndAudio(options);

      expect(mockInvoke).toHaveBeenCalledWith(
        'merge_video_and_audio',
        expect.objectContaining({
          outputPath: '/custom/output.mp4',
        })
      );
    });

    it('should handle all quality levels', async () => {
      setupHappyPathMocks();

      const qualities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      for (const quality of qualities) {
        vi.clearAllMocks();
        setupHappyPathMocks();

        const options: MergeOptions = {
          videoPath: '/path/to/video.mp4',
          audioPath: '/path/to/audio.mp3',
          compressionQuality: quality,
        };

        await videoAudioMergerService.mergeVideoAndAudio(options);

        expect(mockInvoke).toHaveBeenCalledWith(
          'merge_video_and_audio',
          expect.objectContaining({
            quality,
          })
        );
      }
    });

    it('should accept progress callback (tested with placeholder)', async () => {
      setupHappyPathMocks();

      const progressCallback = vi.fn();

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
        onProgress: progressCallback,
      };

      // Just verify the service accepts the callback and completes
      // Note: Progress polling is a placeholder - will be implemented when Swift supports it
      const result = await videoAudioMergerService.mergeVideoAndAudio(options);

      expect(result.success).toBe(true);
      // Progress callback may or may not be called in placeholder implementation
      // This test just verifies we don't crash with a progress callback
    });
  });

  describe('Path Validation', () => {
    it('should throw error if video path is not absolute', async () => {
      mockIsAbsolute.mockImplementation(async (p: string) => p === '/path/to/audio.mp3');
      mockExists.mockResolvedValue(true);
      mockAppDataDir.mockResolvedValue('/Users/test/AppData');
      mockJoin.mockImplementation(async (...parts: string[]) => parts.join('/'));

      const options: MergeOptions = {
        videoPath: 'relative/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
        // Should have thrown
        expect.fail('Should have thrown MergeError');
      } catch (error) {
        expect(error).toBeInstanceOf(MergeError);
        const mergeError = error as MergeError;
        // Since error is caught and re-handled, check message content
        expect(mergeError.userMessage).toContain('absolute');
      }
    });

    it('should throw error if audio path is not absolute', async () => {
      mockIsAbsolute.mockImplementation(async (p: string) => p === '/path/to/video.mp4');
      mockExists.mockResolvedValue(true);
      mockAppDataDir.mockResolvedValue('/Users/test/AppData');
      mockJoin.mockImplementation(async (...parts: string[]) => parts.join('/'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: 'relative/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
        // Should have thrown
        expect.fail('Should have thrown MergeError');
      } catch (error) {
        expect(error).toBeInstanceOf(MergeError);
        const mergeError = error as MergeError;
        expect(mergeError.userMessage).toContain('absolute');
      }
    });

    it('should throw error if video file does not exist', async () => {
      mockIsAbsolute.mockResolvedValue(true);
      mockExists.mockImplementation(async (p: string) => p === '/path/to/audio.mp3');

      const options: MergeOptions = {
        videoPath: '/path/to/missing-video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      await expect(videoAudioMergerService.mergeVideoAndAudio(options)).rejects.toThrow(
        MergeError
      );

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect(error).toBeInstanceOf(MergeError);
        expect((error as MergeError).code).toBe('VIDEO_NOT_FOUND');
        expect((error as MergeError).userMessage).toContain('not found');
      }
    });

    it('should throw error if audio file does not exist', async () => {
      mockIsAbsolute.mockResolvedValue(true);
      mockExists.mockImplementation(async (p: string) => p === '/path/to/video.mp4');

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/missing-audio.mp3',
      };

      await expect(videoAudioMergerService.mergeVideoAndAudio(options)).rejects.toThrow(
        MergeError
      );

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect(error).toBeInstanceOf(MergeError);
        expect((error as MergeError).code).toBe('AUDIO_NOT_FOUND');
        expect((error as MergeError).userMessage).toContain('not found');
      }
    });
  });

  describe('Output Path Generation', () => {
    it('should generate output path with session ID', async () => {
      setupHappyPathMocks();

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
        sessionId: 'session-123',
      };

      await videoAudioMergerService.mergeVideoAndAudio(options);

      expect(mockInvoke).toHaveBeenCalledWith(
        'merge_video_and_audio',
        expect.objectContaining({
          outputPath: expect.stringContaining('session-123-optimized.mp4'),
        })
      );
    });

    it('should generate output path without session ID', async () => {
      setupHappyPathMocks();

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      await videoAudioMergerService.mergeVideoAndAudio(options);

      expect(mockInvoke).toHaveBeenCalledWith(
        'merge_video_and_audio',
        expect.objectContaining({
          outputPath: expect.stringContaining('merged-'),
        })
      );
    });

    it('should use fallback path if appDataDir fails', async () => {
      mockIsAbsolute.mockResolvedValue(true);
      mockExists.mockResolvedValue(true);
      mockAppDataDir.mockRejectedValue(new Error('AppData not available'));
      mockDirname.mockResolvedValue('/path/to');
      mockJoin.mockImplementation(async (...parts: string[]) => parts.join('/'));
      mockInvoke.mockResolvedValue({
        output_path: '/path/to/merged-123.mp4',
        duration: 30.5,
        file_size: 1024000,
        compression_ratio: 0.6,
      });

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      await videoAudioMergerService.mergeVideoAndAudio(options);

      // Should use video directory as fallback
      expect(mockDirname).toHaveBeenCalledWith('/path/to/video.mp4');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockIsAbsolute.mockResolvedValue(true);
      mockExists.mockResolvedValue(true);
      mockAppDataDir.mockResolvedValue('/Users/test/AppData');
      mockJoin.mockImplementation(async (...parts: string[]) => parts.join('/'));
    });

    it('should handle video not found error', async () => {
      mockInvoke.mockRejectedValue(new Error('Video file not found: /path/to/video.mp4'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      await expect(videoAudioMergerService.mergeVideoAndAudio(options)).rejects.toThrow(
        MergeError
      );

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('VIDEO_NOT_FOUND');
        expect((error as MergeError).userMessage).toContain('could not be found');
      }
    });

    it('should handle audio not found error', async () => {
      mockInvoke.mockRejectedValue(new Error('Audio file not found: /path/to/audio.mp3'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('AUDIO_NOT_FOUND');
      }
    });

    it('should handle no video track error', async () => {
      mockInvoke.mockRejectedValue(new Error('Video file contains no video track'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('NO_VIDEO_TRACK');
        expect((error as MergeError).userMessage).toContain('valid video track');
      }
    });

    it('should handle no audio track error', async () => {
      mockInvoke.mockRejectedValue(new Error('Audio file contains no audio track'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('NO_AUDIO_TRACK');
      }
    });

    it('should handle composition failed error', async () => {
      mockInvoke.mockRejectedValue(new Error('Composition failed: AVFoundation error'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('COMPOSITION_FAILED');
        expect((error as MergeError).userMessage).toContain('compose');
      }
    });

    it('should handle export failed error', async () => {
      mockInvoke.mockRejectedValue(new Error('Export failed: Unknown reason'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('EXPORT_FAILED');
      }
    });

    it('should handle cancelled error', async () => {
      mockInvoke.mockRejectedValue(new Error('Export was cancelled'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('CANCELLED');
        expect((error as MergeError).userMessage).toContain('cancelled');
      }
    });

    it('should handle output file exists error', async () => {
      mockInvoke.mockRejectedValue(new Error('Output file already exists: /path/output.mp4'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('OUTPUT_EXISTS');
      }
    });

    it('should handle file system error', async () => {
      mockInvoke.mockRejectedValue(new Error('File system error: Permission denied'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('FILE_SYSTEM_ERROR');
        expect((error as MergeError).userMessage).toContain('permissions');
      }
    });

    it('should handle invalid duration error', async () => {
      mockInvoke.mockRejectedValue(new Error('Invalid track duration'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('INVALID_DURATION');
      }
    });

    it('should handle unknown error', async () => {
      mockInvoke.mockRejectedValue(new Error('Something unexpected happened'));

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect((error as MergeError).code).toBe('UNKNOWN_ERROR');
        expect((error as MergeError).userMessage).toContain('unexpected');
      }
    });

    it('should handle non-Error thrown values', async () => {
      mockInvoke.mockRejectedValue('string error');

      const options: MergeOptions = {
        videoPath: '/path/to/video.mp4',
        audioPath: '/path/to/audio.mp3',
      };

      try {
        await videoAudioMergerService.mergeVideoAndAudio(options);
      } catch (error) {
        expect(error).toBeInstanceOf(MergeError);
      }
    });
  });

  describe('MergeError Class', () => {
    it('should create error with all properties', () => {
      const error = new MergeError('Technical message', 'User message', 'ERROR_CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('MergeError');
      expect(error.message).toBe('Technical message');
      expect(error.userMessage).toBe('User message');
      expect(error.code).toBe('ERROR_CODE');
    });

    it('should be throwable', () => {
      expect(() => {
        throw new MergeError('Test', 'Test user message', 'TEST_CODE');
      }).toThrow(MergeError);
    });
  });
});
