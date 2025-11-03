/**
 * Background Media Processor
 *
 * Orchestrates video/audio processing (concatenation + merging) in the background
 * with progress tracking.
 *
 * **Purpose**: Process session media files after session ends to create optimized
 * MP4 files for instant playback.
 *
 * **Two-Stage Processing**:
 * 1. Audio Concatenation (5s): Merge all audio segments into single MP3
 * 2. Video/Audio Merge (30s): Combine video + audio into optimized MP4
 *
 * **Features**:
 * - Real-time progress callbacks
 * - Error handling with cleanup
 * - Job tracking (multiple sessions)
 * - Singleton pattern for global access
 *
 * @see docs/sessions-rewrite/BACKGROUND_ENRICHMENT_PLAN.md - Task 3
 */

import type { SessionAudioSegment } from '../../types';
import { audioConcatenationService } from '../audioConcatenationService';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';

// ============================================================================
// Types
// ============================================================================

/**
 * Result from video/audio merge operation (from Tauri command)
 */
export interface MergeResult {
  /** Output file path */
  output_path: string;

  /** Total duration in seconds */
  duration: number;

  /** Output file size in bytes */
  file_size: number;

  /** Compression ratio (output_size / input_size), e.g., 0.4 = 60% size reduction */
  compression_ratio: number;
}

/**
 * Processing stage identifier
 */
export type ProcessingStage = 'concatenating' | 'merging' | 'complete';

/**
 * Media processing job definition
 */
export interface MediaProcessingJob {
  sessionId: string;
  sessionName: string;
  videoPath: string | null; // null if no video
  audioSegments: SessionAudioSegment[];
  onProgress: (stage: ProcessingStage, progress: number) => void;
  onComplete: (optimizedVideoPath: string | undefined) => void;
  onError: (error: Error) => void;
}

/**
 * Job state tracking
 */
interface JobState {
  job: MediaProcessingJob;
  cancelled: boolean;
  concatenatedAudioPath?: string;
  optimizedVideoPath?: string;
}

// ============================================================================
// BackgroundMediaProcessor
// ============================================================================

export class BackgroundMediaProcessor {
  private static instance: BackgroundMediaProcessor | null = null;
  private activeJobs: Map<string, JobState> = new Map();

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {
    console.log('🎬 [MEDIA PROCESSOR] Initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BackgroundMediaProcessor {
    if (!BackgroundMediaProcessor.instance) {
      BackgroundMediaProcessor.instance = new BackgroundMediaProcessor();
    }
    return BackgroundMediaProcessor.instance;
  }

  /**
   * Process session media (concatenate audio + merge with video)
   *
   * This is the main entry point. It orchestrates the two-stage processing:
   * 1. Concatenate audio segments (0-50% progress)
   * 2. Merge video + audio (50-100% progress)
   *
   * Progress callbacks fire throughout the process.
   * Cleanup occurs automatically on error.
   */
  async process(job: MediaProcessingJob): Promise<void> {
    const { sessionId, sessionName, videoPath, audioSegments, onProgress, onComplete, onError } = job;

    console.log(`🎬 [MEDIA PROCESSOR] Starting processing for session ${sessionId}`);
    console.log(`🎬 [MEDIA PROCESSOR]   Name: ${sessionName}`);
    console.log(`🎬 [MEDIA PROCESSOR]   Video: ${videoPath ?? 'none'}`);
    console.log(`🎬 [MEDIA PROCESSOR]   Audio segments: ${audioSegments.length}`);

    // Track job state
    const state: JobState = {
      job,
      cancelled: false,
    };
    this.activeJobs.set(sessionId, state);

    try {
      // ===== STAGE 1: CONCATENATE AUDIO (0-50%) =====
      let concatenatedAudioPath: string | null = null;

      if (audioSegments.length > 0) {
        onProgress('concatenating', 0);
        console.log(`🎵 [MEDIA PROCESSOR] Stage 1: Concatenating ${audioSegments.length} audio segments...`);

        concatenatedAudioPath = await this.concatenateAudio(sessionId, audioSegments, (progress) => {
          // Check if cancelled
          if (state.cancelled) {
            throw new Error('Processing cancelled by user');
          }
          // Map 0-100 to 0-50 for overall progress
          onProgress('concatenating', progress * 0.5);
        });

        state.concatenatedAudioPath = concatenatedAudioPath;
        console.log(`✅ [MEDIA PROCESSOR] Audio concatenated: ${concatenatedAudioPath}`);
        onProgress('concatenating', 50); // Stage 1 complete
      } else {
        console.log(`ℹ️  [MEDIA PROCESSOR] No audio segments, skipping concatenation`);
        onProgress('concatenating', 50); // Skip to 50%
      }

      // ===== STAGE 2: MERGE VIDEO + AUDIO (50-100%) =====
      let optimizedVideoPath: string | undefined = undefined;

      if (videoPath || concatenatedAudioPath) {
        onProgress('merging', 50);
        console.log(`🎬 [MEDIA PROCESSOR] Stage 2: Merging video and audio...`);

        optimizedVideoPath = await this.mergeVideoAndAudio(
          sessionId,
          videoPath,
          concatenatedAudioPath,
          (progress) => {
            // Check if cancelled
            if (state.cancelled) {
              throw new Error('Processing cancelled by user');
            }
            // Map 0-100 to 50-100 for overall progress
            onProgress('merging', 50 + progress * 0.5);
          }
        );

        state.optimizedVideoPath = optimizedVideoPath;
        console.log(`✅ [MEDIA PROCESSOR] Video merged: ${optimizedVideoPath}`);
        onProgress('merging', 100); // Stage 2 complete
      } else {
        console.log(`ℹ️  [MEDIA PROCESSOR] No video or audio, skipping merge`);
        onProgress('merging', 100); // Skip to 100%
      }

      // ===== COMPLETE =====
      onProgress('complete', 100);
      console.log(`🎉 [MEDIA PROCESSOR] Processing complete for session ${sessionId}`);
      console.log(`🎉 [MEDIA PROCESSOR]   Optimized file: ${optimizedVideoPath || 'none'}`);

      onComplete(optimizedVideoPath);

      // Remove from active jobs
      this.activeJobs.delete(sessionId);
    } catch (error) {
      console.error(`❌ [MEDIA PROCESSOR] Processing failed for session ${sessionId}:`, error);

      // Cleanup temporary files
      await this.cleanup(sessionId);

      // Remove from active jobs
      this.activeJobs.delete(sessionId);

      // Report error
      onError(
        error instanceof Error
          ? error
          : new Error(`Media processing failed: ${String(error)}`)
      );
    }
  }

  /**
   * Concatenate audio segments into single MP3 file
   *
   * NEW APPROACH (Phase 4 memory fix):
   * 1. Load MP3 attachments from CA storage (already compressed!)
   * 2. Write each MP3 to temp files
   * 3. Use ffmpeg to concatenate MP3s directly (stream copy, no re-encoding)
   * 4. Clean up temp files
   *
   * This avoids:
   * - Decoding MP3 to AudioBuffer (50-100MB per segment)
   * - Holding AudioBuffers in memory (5-10GB total)
   * - Creating massive WAV blob (500MB-2GB)
   *
   * @param sessionId - Session ID
   * @param audioSegments - Audio segments to concatenate
   * @param onProgress - Progress callback (0-100)
   * @returns Path to concatenated MP3 file
   */
  private async concatenateAudio(
    sessionId: string,
    audioSegments: SessionAudioSegment[],
    onProgress: (progress: number) => void
  ): Promise<string> {
    console.log(`🎵 [MP3 CONCAT] Concatenating ${audioSegments.length} MP3 segments for session ${sessionId}...`);

    const startTime = performance.now();
    const tempFilePaths: string[] = [];

    try {
      // Report initial progress
      onProgress(10);

      // Step 1: Load MP3 attachments from CA storage and write to temp files
      console.log(`📦 [MP3 CONCAT] Loading ${audioSegments.length} MP3 attachments from storage...`);

      const { getCAStorage } = await import('../storage/ContentAddressableStorage');
      const caStorage = await getCAStorage();

      for (let i = 0; i < audioSegments.length; i++) {
        const segment = audioSegments[i];

        // Check for hash (Phase 4) or attachmentId (legacy)
        if (!segment.hash && !segment.attachmentId) {
          console.warn(`⚠️  [MP3 CONCAT] Segment ${segment.id} has no hash or attachmentId, skipping`);
          continue;
        }

        // Load attachment from CA storage
        const attachment = segment.hash
          ? await caStorage.loadAttachment(segment.hash)
          : null;

        if (!attachment) {
          console.warn(`⚠️  [MP3 CONCAT] Failed to load attachment for segment ${segment.id}, skipping`);
          continue;
        }

        // Strip data URL prefix if present (e.g., "data:audio/mp3;base64,")
        let base64Data = attachment.base64;
        if (!base64Data) {
          throw new Error('Attachment has no base64 data');
        }
        if (base64Data.startsWith('data:') && base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }

        // Remove any whitespace or newlines that might cause atob() to fail
        base64Data = base64Data.replace(/\s/g, '');

        // Decode base64 MP3 data to Uint8Array
        const mp3Data = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Generate temp file path in videos directory (will clean up after)
        const videosDir = await appDataDir();
        const tempFilePath = `${videosDir}/videos/temp-audio-segment-${sessionId}-${i}.mp3`;
        tempFilePaths.push(tempFilePath);

        // Write MP3 to temp file using Tauri command (not plugin-fs)
        await invoke('write_file', {
          path: tempFilePath,
          contents: Array.from(mp3Data),
        });

        console.log(`✅ [MP3 CONCAT] Wrote segment ${i + 1}/${audioSegments.length} to temp file: ${(mp3Data.length / 1024).toFixed(0)}KB`);
      }

      onProgress(50); // All segments written to temp files

      if (tempFilePaths.length === 0) {
        throw new Error('No audio segments to concatenate');
      }

      // Step 2: Use ffmpeg to concatenate MP3 files (stream copy, no re-encoding)
      console.log(`🎬 [MP3 CONCAT] Concatenating ${tempFilePaths.length} MP3 files with ffmpeg...`);

      const videosDir = await appDataDir();
      const outputPath = `${videosDir}/videos/${sessionId}-audio.mp3`;

      await invoke<string>('concatenate_mp3_files', {
        inputPaths: tempFilePaths,
        outputPath,
      });

      onProgress(90); // Concatenation complete

      // Step 3: Clean up temp files
      console.log(`🧹 [MP3 CONCAT] Cleaning up ${tempFilePaths.length} temp files...`);
      for (const tempPath of tempFilePaths) {
        try {
          await invoke('delete_file', { path: tempPath });
        } catch (err) {
          console.warn(`⚠️  [MP3 CONCAT] Failed to delete temp file ${tempPath}:`, err);
        }
      }

      onProgress(100); // Cleanup complete

      const duration = performance.now() - startTime;
      console.log(`✅ [MP3 CONCAT] Concatenation complete in ${duration.toFixed(0)}ms`);
      console.log(`✅ [MP3 CONCAT]   Output: ${outputPath}`);

      return outputPath;
    } catch (error) {
      console.error(`❌ [MP3 CONCAT] Failed to concatenate audio:`, error);

      // Clean up temp files on error
      for (const tempPath of tempFilePaths) {
        try {
          await invoke('delete_file', { path: tempPath });
        } catch {
          // Ignore cleanup errors
        }
      }

      throw new Error(`Audio concatenation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Merge video and audio into single optimized MP4
   *
   * Handles multiple cases:
   * - Both video and audio: Merge into optimized MP4
   * - Video only: Copy/optimize video
   * - Audio only: Return audio path (no merge needed)
   * - Neither: Return undefined
   *
   * @param sessionId - Session ID
   * @param videoPath - Path to video file (or null)
   * @param audioPath - Path to audio file (or null)
   * @param onProgress - Progress callback (0-100)
   * @returns Path to optimized MP4 file (or undefined if no media)
   */
  private async mergeVideoAndAudio(
    sessionId: string,
    videoPath: string | null,
    audioPath: string | null,
    onProgress: (progress: number) => void
  ): Promise<string | undefined> {
    console.log(`🎬 [VIDEO MERGE] Starting merge for session ${sessionId}`);
    console.log(`🎬 [VIDEO MERGE]   Video: ${videoPath || 'none'}`);
    console.log(`🎬 [VIDEO MERGE]   Audio: ${audioPath || 'none'}`);

    const startTime = performance.now();

    // If neither video nor audio, return undefined
    if (!videoPath && !audioPath) {
      console.log(`ℹ️  [VIDEO MERGE] No video or audio to merge`);
      return undefined;
    }

    // If audio only (no video), return audio path
    if (!videoPath && audioPath) {
      console.log(`ℹ️  [VIDEO MERGE] Audio-only session, no merge needed`);
      onProgress(100);
      return audioPath;
    }

    // If video only or video + audio, call Tauri merge command
    try {
      onProgress(0);

      // Generate output path
      const videosDir = await appDataDir();
      const outputPath = `${videosDir}/videos/${sessionId}-optimized.mp4`;

      console.log(`🎬 [VIDEO MERGE] Output: ${outputPath}`);
      console.log(`🎬 [VIDEO MERGE] Calling Tauri merge_video_and_audio command...`);

      // Call Tauri command for video/audio merge
      const result = await invoke<MergeResult>('merge_video_and_audio', {
        videoPath: videoPath || '',
        audioPath: audioPath || '',
        outputPath,
        quality: 'medium', // Use medium quality by default (60% size reduction)
      });

      onProgress(100);

      const duration = performance.now() - startTime;
      console.log(`✅ [VIDEO MERGE] Merge complete in ${(duration / 1000).toFixed(1)}s`);
      console.log(`✅ [VIDEO MERGE]   Output: ${result.output_path}`);
      console.log(`✅ [VIDEO MERGE]   Size: ${(result.file_size / 1024 / 1024).toFixed(1)} MB`);
      console.log(`✅ [VIDEO MERGE]   Duration: ${result.duration.toFixed(1)}s`);
      console.log(`✅ [VIDEO MERGE]   Compression: ${(result.compression_ratio * 100).toFixed(1)}% of original size`);

      return result.output_path;
    } catch (error) {
      console.error(`❌ [VIDEO MERGE] Failed to merge video/audio:`, error);
      throw new Error(`Video merge failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cancel processing for a session
   *
   * Sets the cancelled flag, which will be checked by processing stages.
   * Note: Cancellation is best-effort (doesn't forcibly kill processes).
   */
  async cancel(sessionId: string): Promise<void> {
    const state = this.activeJobs.get(sessionId);
    if (!state) {
      console.warn(`⚠️  [MEDIA PROCESSOR] Cannot cancel: no active job for session ${sessionId}`);
      return;
    }

    console.log(`🛑 [MEDIA PROCESSOR] Cancelling processing for session ${sessionId}`);
    state.cancelled = true;

    // Cleanup will happen in process() catch block
  }

  /**
   * Check if a session is currently being processed
   */
  isProcessing(sessionId: string): boolean {
    return this.activeJobs.has(sessionId);
  }

  /**
   * Get list of active job session IDs
   */
  getActiveJobs(): string[] {
    return Array.from(this.activeJobs.keys());
  }

  /**
   * Cleanup temporary files for a session
   *
   * Removes concatenated audio file (if exists).
   * The optimized video file is kept (it's the final output).
   */
  private async cleanup(sessionId: string): Promise<void> {
    console.log(`🧹 [MEDIA PROCESSOR] Cleaning up temporary files for session ${sessionId}`);

    const state = this.activeJobs.get(sessionId);
    if (!state) {
      console.log(`ℹ️  [MEDIA PROCESSOR] No state to cleanup for session ${sessionId}`);
      return;
    }

    const filesToDelete: string[] = [];

    // Add concatenated audio to cleanup list (this is temporary)
    if (state.concatenatedAudioPath) {
      filesToDelete.push(state.concatenatedAudioPath);
    }

    // Delete files
    for (const filePath of filesToDelete) {
      try {
        console.log(`🗑️  [MEDIA PROCESSOR] Deleting temporary file: ${filePath}`);
        await invoke('delete_file', { path: filePath });
        console.log(`✅ [MEDIA PROCESSOR] Deleted: ${filePath}`);
      } catch (error) {
        console.warn(`⚠️  [MEDIA PROCESSOR] Failed to delete ${filePath}:`, error);
        // Non-fatal: continue cleanup
      }
    }

    console.log(`✅ [MEDIA PROCESSOR] Cleanup complete for session ${sessionId}`);
  }

  /**
   * Get cache statistics from audio concatenation service
   */
  getCacheStats() {
    return audioConcatenationService.getCacheStats();
  }

  /**
   * Clear audio concatenation cache for a session
   */
  clearCache(sessionId?: string) {
    audioConcatenationService.clearCache(sessionId);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Get the global BackgroundMediaProcessor instance
 */
export function getBackgroundMediaProcessor(): BackgroundMediaProcessor {
  return BackgroundMediaProcessor.getInstance();
}
