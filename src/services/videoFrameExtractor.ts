/**
 * VideoFrameExtractor
 *
 * Extracts individual frames from video recordings for AI analysis.
 * Uses the existing Swift thumbnail generation infrastructure.
 */

import { invoke } from '@tauri-apps/api/core';

export interface VideoFrame {
  timestamp: number; // Seconds from session start
  dataUri: string; // Base64 PNG data URI
  width: number;
  height: number;
}

class VideoFrameExtractor {
  /**
   * Extract a single frame from video at specified timestamp
   *
   * @param videoPath - Absolute path to video file
   * @param timestamp - Time in seconds from session start
   * @returns Frame as base64 data URI
   */
  async extractFrame(
    videoPath: string,
    timestamp: number
  ): Promise<VideoFrame> {
    console.log(`🎬 [FRAME EXTRACTOR] Extracting frame at ${timestamp}s from ${videoPath}`);

    try {
      // Use existing Swift thumbnail generation
      const dataUri = await invoke<string>('generate_video_thumbnail', {
        videoPath,
        time: timestamp
      });

      return {
        timestamp,
        dataUri,
        width: 320, // Our current thumbnail size
        height: 180
      };
    } catch (error) {
      console.error('❌ [FRAME EXTRACTOR] Failed to extract frame:', error);
      throw new Error(`Failed to extract frame at ${timestamp}s: ${error}`);
    }
  }

  /**
   * Extract multiple frames from video
   *
   * @param videoPath - Absolute path to video file
   * @param timestamps - Array of timestamps in seconds
   * @returns Array of frames
   */
  async extractFrames(
    videoPath: string,
    timestamps: number[]
  ): Promise<VideoFrame[]> {
    console.log(`🎬 [FRAME EXTRACTOR] Extracting ${timestamps.length} frames`);

    const frames: VideoFrame[] = [];

    for (const timestamp of timestamps) {
      try {
        const frame = await this.extractFrame(videoPath, timestamp);
        frames.push(frame);
      } catch (error) {
        console.warn(`⚠️ [FRAME EXTRACTOR] Skipping frame at ${timestamp}s:`, error);
      }
    }

    return frames;
  }

  /**
   * Extract frames at regular intervals (useful for AI analysis)
   *
   * @param videoPath - Absolute path to video file
   * @param duration - Video duration in seconds
   * @param intervalSeconds - Interval between frames (default: 30s)
   * @returns Array of frames
   */
  async extractFramesAtInterval(
    videoPath: string,
    duration: number,
    intervalSeconds: number = 30
  ): Promise<VideoFrame[]> {
    const timestamps: number[] = [];

    // Generate timestamps at intervals
    for (let t = 0; t < duration; t += intervalSeconds) {
      timestamps.push(t);
    }

    // Always include last frame
    if (timestamps[timestamps.length - 1] !== duration) {
      timestamps.push(duration - 1); // 1 second before end
    }

    console.log(`🎬 [FRAME EXTRACTOR] Extracting frames at ${intervalSeconds}s intervals (${timestamps.length} frames)`);

    return this.extractFrames(videoPath, timestamps);
  }
}

export const videoFrameExtractor = new VideoFrameExtractor();
