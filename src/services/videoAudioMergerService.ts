/**
 * Video/Audio Merger Service
 *
 * TypeScript wrapper for Tauri video/audio merging command.
 * Merges separate video and audio files using AVFoundation (via Swift).
 *
 * Features:
 * - Path validation before merging
 * - Automatic output path generation
 * - Compression quality settings (low/medium/high)
 * - Progress polling support (for future streaming implementation)
 * - User-friendly error messages
 *
 * Usage:
 * ```typescript
 * import { videoAudioMergerService } from '@/services/videoAudioMergerService';
 *
 * const result = await videoAudioMergerService.mergeVideoAndAudio({
 *   videoPath: '/path/to/video.mp4',
 *   audioPath: '/path/to/audio.mp3',
 *   compressionQuality: 'medium',
 *   onProgress: (progress) => console.log(`${progress}%`),
 * });
 * ```
 *
 * Note: Tasks 4 & 5 (Swift VideoAudioMerger and Rust FFI) are COMPLETE.
 * Task 7 will add the Tauri command. This service is ready to use once that's done.
 */

import { invoke } from '@tauri-apps/api/core';
import { exists } from '@tauri-apps/plugin-fs';
import { path } from '@tauri-apps/api';

/**
 * Compression quality preset
 *
 * Maps to Swift ExportQuality enum:
 * - low: AVAssetExportPresetMediumQuality (~40% size)
 * - medium: AVAssetExportPresetHighQuality (~60% size) [DEFAULT]
 * - high: AVAssetExportPresetHEVCHighestQuality (~80% size)
 */
export type CompressionQuality = 'low' | 'medium' | 'high';

/**
 * Options for merging video and audio
 */
export interface MergeOptions {
  /** Path to video file (MP4, MOV, no audio required) */
  videoPath: string;

  /** Path to audio file (MP3, WAV, M4A, AAC) */
  audioPath: string;

  /** Output path (auto-generated if not provided) */
  outputPath?: string;

  /** Compression quality preset (default: 'medium') */
  compressionQuality?: CompressionQuality;

  /** Progress callback (0-100) */
  onProgress?: (progress: number) => void;

  /** Optional session ID for naming output file */
  sessionId?: string;
}

/**
 * Result of successful merge operation
 */
export interface MergeResult {
  /** Was the merge successful? */
  success: boolean;

  /** Output file path */
  outputPath: string;

  /** Total duration in seconds */
  duration: number;

  /** Output file size in bytes */
  fileSize: number;

  /** Compression ratio (output_size / input_size) */
  compressionRatio: number;
}

/**
 * Merge error with user-friendly message
 */
export class MergeError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'MergeError';
  }
}

/**
 * Video/Audio Merger Service
 *
 * Singleton service for merging video and audio files.
 */
class VideoAudioMergerService {
  private static instance: VideoAudioMergerService;

  // Progress polling state (for future implementation)
  private progressPollingInterval: number | null = null;
  private progressCallbacks: Map<string, (progress: number) => void> = new Map();

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): VideoAudioMergerService {
    if (!VideoAudioMergerService.instance) {
      VideoAudioMergerService.instance = new VideoAudioMergerService();
    }
    return VideoAudioMergerService.instance;
  }

  /**
   * Merge video and audio files
   *
   * Main method for merging video and audio into a single MP4 file.
   *
   * @param options - Merge options
   * @returns Promise<MergeResult> on success
   * @throws MergeError on failure
   *
   * @example
   * ```typescript
   * const result = await videoAudioMergerService.mergeVideoAndAudio({
   *   videoPath: '/path/to/video.mp4',
   *   audioPath: '/path/to/audio.mp3',
   *   compressionQuality: 'medium',
   *   onProgress: (progress) => console.log(`Progress: ${progress}%`),
   * });
   * console.log(`Merged: ${result.outputPath} (${result.fileSize} bytes)`);
   * ```
   */
  async mergeVideoAndAudio(options: MergeOptions): Promise<MergeResult> {
    const {
      videoPath,
      audioPath,
      outputPath: userOutputPath,
      compressionQuality = 'medium',
      onProgress,
      sessionId,
    } = options;

    console.log('🎬 [VIDEO AUDIO MERGER] Starting merge:', {
      videoPath,
      audioPath,
      quality: compressionQuality,
    });

    try {
      // Step 1: Validate paths
      await this.validatePaths(videoPath, audioPath);

      // Step 2: Generate output path if not provided
      const outputPath =
        userOutputPath || (await this.generateOutputPath(videoPath, sessionId));

      console.log('📁 [VIDEO AUDIO MERGER] Output path:', outputPath);

      // Step 3: Set up progress polling (if callback provided)
      let progressKey: string | null = null;
      if (onProgress) {
        progressKey = this.generateProgressKey(videoPath, audioPath);
        this.progressCallbacks.set(progressKey, onProgress);
        this.startProgressPolling(progressKey, onProgress);
      }

      // Step 4: Invoke Tauri command
      // NOTE: This command will be added in Task 7
      // For now, we provide the interface that Task 7 will implement
      const result = await invoke<{
        output_path: string;
        duration: number;
        file_size: number;
        compression_ratio: number;
      }>('merge_video_and_audio', {
        videoPath,
        audioPath,
        outputPath,
        quality: compressionQuality,
      });

      // Step 5: Clean up progress polling
      if (progressKey) {
        this.stopProgressPolling(progressKey);
      }

      // Step 6: Return result
      const mergeResult: MergeResult = {
        success: true,
        outputPath: result.output_path,
        duration: result.duration,
        fileSize: result.file_size,
        compressionRatio: result.compression_ratio,
      };

      console.log('✅ [VIDEO AUDIO MERGER] Merge completed:', {
        outputPath: mergeResult.outputPath,
        fileSize: mergeResult.fileSize,
        compressionRatio: `${(mergeResult.compressionRatio * 100).toFixed(1)}%`,
      });

      return mergeResult;
    } catch (error) {
      console.error('❌ [VIDEO AUDIO MERGER] Merge failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Validate that video and audio files exist
   *
   * @param videoPath - Path to video file
   * @param audioPath - Path to audio file
   * @throws MergeError if files don't exist or paths are invalid
   */
  private async validatePaths(videoPath: string, audioPath: string): Promise<void> {
    console.log('🔍 [VIDEO AUDIO MERGER] Validating paths...');

    // Check if paths are absolute
    const isVideoAbsolute = await path.isAbsolute(videoPath);
    const isAudioAbsolute = await path.isAbsolute(audioPath);

    if (!isVideoAbsolute) {
      throw new MergeError(
        `Video path is not absolute: ${videoPath}`,
        'Video file path must be absolute',
        'PATH_NOT_ABSOLUTE'
      );
    }

    if (!isAudioAbsolute) {
      throw new MergeError(
        `Audio path is not absolute: ${audioPath}`,
        'Audio file path must be absolute',
        'PATH_NOT_ABSOLUTE'
      );
    }

    // Check if video file exists
    const videoExists = await exists(videoPath);
    if (!videoExists) {
      throw new MergeError(
        `Video file not found: ${videoPath}`,
        'Video file not found. Please check the path.',
        'VIDEO_NOT_FOUND'
      );
    }

    // Check if audio file exists
    const audioExists = await exists(audioPath);
    if (!audioExists) {
      throw new MergeError(
        `Audio file not found: ${audioPath}`,
        'Audio file not found. Please check the path.',
        'AUDIO_NOT_FOUND'
      );
    }

    console.log('✅ [VIDEO AUDIO MERGER] Paths validated');
  }

  /**
   * Generate output path for merged video
   *
   * Generates path in AppData/videos directory with format:
   * - With sessionId: {sessionId}-optimized.mp4
   * - Without sessionId: merged-{timestamp}.mp4
   *
   * @param videoPath - Original video path (for fallback)
   * @param sessionId - Optional session ID for naming
   * @returns Output path
   */
  private async generateOutputPath(
    videoPath: string,
    sessionId?: string
  ): Promise<string> {
    try {
      // Get AppData directory
      const appDataDir = await path.appDataDir();

      // Create videos subdirectory path
      const videosDir = await path.join(appDataDir, 'videos');

      // Generate filename
      let filename: string;
      if (sessionId) {
        filename = `${sessionId}-optimized.mp4`;
      } else {
        const timestamp = Date.now();
        filename = `merged-${timestamp}.mp4`;
      }

      // Join to create full path
      const outputPath = await path.join(videosDir, filename);

      console.log('📝 [VIDEO AUDIO MERGER] Generated output path:', outputPath);

      return outputPath;
    } catch (error) {
      console.error('❌ [VIDEO AUDIO MERGER] Failed to generate output path:', error);

      // Fallback: Use same directory as video file
      const videoDir = await path.dirname(videoPath);
      const timestamp = Date.now();
      const filename = sessionId ? `${sessionId}-optimized.mp4` : `merged-${timestamp}.mp4`;
      const fallbackPath = await path.join(videoDir, filename);

      console.log('⚠️  [VIDEO AUDIO MERGER] Using fallback path:', fallbackPath);

      return fallbackPath;
    }
  }

  /**
   * Generate unique key for progress tracking
   *
   * @param videoPath - Video file path
   * @param audioPath - Audio file path
   * @returns Progress tracking key
   */
  private generateProgressKey(videoPath: string, audioPath: string): string {
    return `${videoPath}:${audioPath}`;
  }

  /**
   * Start progress polling
   *
   * NOTE: Swift doesn't support streaming progress yet (Task 5 limitation).
   * This is a placeholder for future implementation.
   *
   * For now, progress callbacks are invoked via the Swift FFI callback mechanism.
   * Future: Poll Tauri command for progress state.
   *
   * @param progressKey - Progress tracking key
   * @param callback - Progress callback
   */
  private startProgressPolling(progressKey: string, callback: (progress: number) => void): void {
    console.log('📊 [VIDEO AUDIO MERGER] Progress polling: Not implemented (Swift limitation)');

    // Placeholder: Simulate progress for UX
    // This will be replaced with actual polling once Swift supports it
    let progress = 0;
    const interval = setInterval(() => {
      if (progress < 90) {
        progress += 10;
        callback(progress);
      }
    }, 1000);

    this.progressPollingInterval = interval as unknown as number;
  }

  /**
   * Stop progress polling
   *
   * @param progressKey - Progress tracking key
   */
  private stopProgressPolling(progressKey: string): void {
    if (this.progressPollingInterval !== null) {
      clearInterval(this.progressPollingInterval);
      this.progressPollingInterval = null;
    }

    this.progressCallbacks.delete(progressKey);

    // Ensure progress reaches 100% on completion
    const callback = this.progressCallbacks.get(progressKey);
    if (callback) {
      callback(100);
    }
  }

  /**
   * Handle errors and map to user-friendly messages
   *
   * @param error - Raw error from Tauri command
   * @returns MergeError with user-friendly message
   */
  private handleError(error: unknown): MergeError {
    console.error('🔍 [VIDEO AUDIO MERGER] Handling error:', error);

    // If already a MergeError, just return it
    if (error instanceof MergeError) {
      return error;
    }

    // Parse error message
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Map to user-friendly messages
    if (errorMsg.includes('Video file not found')) {
      return new MergeError(
        errorMsg,
        'The video file could not be found. Please check the path.',
        'VIDEO_NOT_FOUND'
      );
    }

    if (errorMsg.includes('Audio file not found')) {
      return new MergeError(
        errorMsg,
        'The audio file could not be found. Please check the path.',
        'AUDIO_NOT_FOUND'
      );
    }

    if (errorMsg.includes('no video track')) {
      return new MergeError(
        errorMsg,
        'The video file does not contain a valid video track.',
        'NO_VIDEO_TRACK'
      );
    }

    if (errorMsg.includes('no audio track')) {
      return new MergeError(
        errorMsg,
        'The audio file does not contain a valid audio track.',
        'NO_AUDIO_TRACK'
      );
    }

    if (errorMsg.includes('Composition failed')) {
      return new MergeError(
        errorMsg,
        'Failed to compose video and audio. The files may be corrupted or incompatible.',
        'COMPOSITION_FAILED'
      );
    }

    if (errorMsg.includes('Export failed')) {
      return new MergeError(
        errorMsg,
        'Failed to export merged video. Please try again.',
        'EXPORT_FAILED'
      );
    }

    if (errorMsg.includes('cancelled')) {
      return new MergeError(errorMsg, 'Merge operation was cancelled.', 'CANCELLED');
    }

    if (errorMsg.includes('Output file already exists')) {
      return new MergeError(
        errorMsg,
        'Output file already exists. Please choose a different name.',
        'OUTPUT_EXISTS'
      );
    }

    if (errorMsg.includes('File system error')) {
      return new MergeError(
        errorMsg,
        'A file system error occurred. Please check permissions.',
        'FILE_SYSTEM_ERROR'
      );
    }

    if (errorMsg.includes('Invalid track duration')) {
      return new MergeError(
        errorMsg,
        'Invalid video or audio duration. Files may be corrupted.',
        'INVALID_DURATION'
      );
    }

    // Generic error
    return new MergeError(
      errorMsg,
      'An unexpected error occurred during merge. Please try again.',
      'UNKNOWN_ERROR'
    );
  }
}

/**
 * Singleton instance of VideoAudioMergerService
 */
export const videoAudioMergerService = VideoAudioMergerService.getInstance();
