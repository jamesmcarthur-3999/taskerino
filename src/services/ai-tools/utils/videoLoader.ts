/**
 * Video Loader Utility
 *
 * Centralized video data loading and frame extraction.
 * Uses existing videoFrameExtractor infrastructure.
 */

import type { Session } from '../../../types';
import { videoFrameExtractor } from '../../videoFrameExtractor';
import { invoke } from '@tauri-apps/api/core';
import {
  videoNotFoundError,
  noVideoRecordingError,
  videoFrameExtractionError,
  storageError,
  logInfo,
  logWarning
} from './errorHandling';
import {
  hasVideoRecording,
  getVideoPath,
  getSessionDuration
} from './sessionLoader';

/**
 * Video frame data
 */
export interface VideoFrame {
  timestamp: number; // Seconds from session start
  data_uri: string; // Base64 PNG data URI
  width: number;
  height: number;
}

/**
 * Video metadata
 */
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec?: string;
  file_size?: number;
  path: string;
}

/**
 * Extract single video frame at timestamp
 */
export async function extractFrame(
  session: Session,
  timestamp: number
): Promise<VideoFrame> {
  if (!hasVideoRecording(session)) {
    throw noVideoRecordingError(session.id);
  }

  const videoPath = getVideoPath(session);
  if (!videoPath) {
    throw videoNotFoundError(session.id);
  }

  try {
    logInfo('VideoLoader', `Extracting frame at ${timestamp}s from ${videoPath}`);

    const frame = await videoFrameExtractor.extractFrame(videoPath, timestamp);

    return {
      timestamp,
      data_uri: frame.dataUri,
      width: frame.width,
      height: frame.height
    };

  } catch (error) {
    throw videoFrameExtractionError(timestamp, error);
  }
}

/**
 * Extract multiple frames at specific timestamps
 */
export async function extractFrames(
  session: Session,
  timestamps: number[]
): Promise<VideoFrame[]> {
  if (!hasVideoRecording(session)) {
    throw noVideoRecordingError(session.id);
  }

  const videoPath = getVideoPath(session);
  if (!videoPath) {
    throw videoNotFoundError(session.id);
  }

  logInfo('VideoLoader', `Extracting ${timestamps.length} frames from ${videoPath}`);

  const frames: VideoFrame[] = [];
  const errors: Array<{ timestamp: number; error: string }> = [];

  // Extract frames sequentially to avoid overloading
  for (const timestamp of timestamps) {
    try {
      const frame = await extractFrame(session, timestamp);
      frames.push(frame);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logWarning('VideoLoader', `Failed to extract frame at ${timestamp}s: ${errorMsg}`);
      errors.push({ timestamp, error: errorMsg });
    }
  }

  if (errors.length > 0) {
    logWarning('VideoLoader', `Failed to extract ${errors.length}/${timestamps.length} frames`, { errors });
  }

  logInfo('VideoLoader', `Successfully extracted ${frames.length}/${timestamps.length} frames`);

  return frames;
}

/**
 * Extract frames at regular intervals
 */
export async function extractFramesByInterval(
  session: Session,
  intervalSeconds: number,
  maxFrames: number = 50
): Promise<VideoFrame[]> {
  if (!hasVideoRecording(session)) {
    throw noVideoRecordingError(session.id);
  }

  const duration = getSessionDuration(session);

  // Calculate timestamps at intervals
  const timestamps: number[] = [];
  for (let time = 0; time < duration && timestamps.length < maxFrames; time += intervalSeconds) {
    timestamps.push(time);
  }

  // Ensure we get the last frame
  if (timestamps[timestamps.length - 1] < duration - 1) {
    timestamps.push(duration - 1);
  }

  // Trim to maxFrames
  if (timestamps.length > maxFrames) {
    timestamps.length = maxFrames;
  }

  logInfo('VideoLoader', `Extracting frames at ${intervalSeconds}s intervals (${timestamps.length} frames)`);

  return await extractFrames(session, timestamps);
}

/**
 * Get video metadata
 */
export async function getVideoMetadata(session: Session): Promise<VideoMetadata> {
  if (!hasVideoRecording(session)) {
    throw noVideoRecordingError(session.id);
  }

  const videoPath = getVideoPath(session);
  if (!videoPath) {
    throw videoNotFoundError(session.id);
  }

  try {
    logInfo('VideoLoader', `Getting video metadata: ${videoPath}`);

    // Get duration from session or video object
    const duration = session.video?.duration || getSessionDuration(session);

    // Get file stats from Tauri
    const fs = await import('@tauri-apps/plugin-fs');
    const fileInfo = await fs.stat(videoPath);

    // Get video resolution and codec (if available)
    // For now, use defaults - can extend with ffprobe if needed
    const width = session.video?.width || 1920;
    const height = session.video?.height || 1080;

    return {
      duration,
      width,
      height,
      codec: 'h264', // Our standard codec
      file_size: fileInfo.size,
      path: videoPath
    };

  } catch (error) {
    throw storageError('get video metadata', error, { sessionId: session.id, videoPath });
  }
}

/**
 * Validate timestamp is within video duration
 */
export function validateTimestampInVideo(
  session: Session,
  timestamp: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const duration = getSessionDuration(session);

  if (timestamp < 0) {
    errors.push(`Timestamp cannot be negative: ${timestamp}`);
  }

  if (timestamp > duration) {
    errors.push(`Timestamp (${timestamp}s) exceeds video duration (${duration}s)`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate optimal interval for frame extraction
 * Returns interval that will extract approximately targetFrames
 */
export function calculateOptimalInterval(
  duration: number,
  targetFrames: number = 20
): number {
  const interval = Math.max(1, Math.floor(duration / targetFrames));
  return interval;
}

/**
 * Estimate memory usage for frame extraction
 */
export function estimateFrameMemory(
  frameCount: number,
  width: number = 1920,
  height: number = 1080
): { bytes: number; megabytes: number } {
  // PNG base64: ~4 bytes per pixel (RGBA) * 1.33 (base64 overhead)
  const bytesPerFrame = width * height * 4 * 1.33;
  const totalBytes = bytesPerFrame * frameCount;

  return {
    bytes: totalBytes,
    megabytes: totalBytes / (1024 * 1024)
  };
}
