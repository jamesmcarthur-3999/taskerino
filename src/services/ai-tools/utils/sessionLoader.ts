/**
 * Session Loader Utility
 *
 * Centralized session data loading with validation and error handling.
 * Used by all AI tools to access session data safely.
 */

import type { Session, SessionScreenshot, SessionAudioSegment } from '../../../types';
import { getChunkedStorage } from '../../storage/ChunkedSessionStorage';
import {
  sessionNotFoundError,
  segmentNotFoundError,
  screenshotNotFoundError,
  noAudioSegmentsError,
  logInfo,
  logWarning
} from './errorHandling';
import { validateSessionId, validateSegmentId, validateScreenshotId } from './validation';

/**
 * Load session with full data
 * Uses ChunkedSessionStorage for efficient loading
 */
export async function loadSession(sessionId: string): Promise<Session> {
  // Validate session ID
  const validation = validateSessionId(sessionId);
  if (!validation.valid) {
    throw new Error(`Invalid session ID: ${validation.errors.join(', ')}`);
  }

  try {
    logInfo('SessionLoader', `Loading session: ${sessionId}`);

    const chunkedStorage = await getChunkedStorage();
    const session = await chunkedStorage.loadFullSession(sessionId);

    if (!session) {
      throw sessionNotFoundError(sessionId);
    }

    logInfo('SessionLoader', `Loaded session: ${sessionId}`, {
      screenshots: session.screenshots.length,
      audioSegments: session.audioSegments?.length || 0,
      hasVideo: !!session.video
    });

    return session;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw sessionNotFoundError(sessionId);
    }
    throw error;
  }
}

/**
 * Load session metadata only (faster, no chunks)
 */
export async function loadSessionMetadata(sessionId: string): Promise<Session> {
  const validation = validateSessionId(sessionId);
  if (!validation.valid) {
    throw new Error(`Invalid session ID: ${validation.errors.join(', ')}`);
  }

  try {
    const chunkedStorage = await getChunkedStorage();
    const metadata = await chunkedStorage.loadMetadata(sessionId);

    if (!metadata) {
      throw sessionNotFoundError(sessionId);
    }

    // Return metadata as session (has most fields)
    // NOTE: This is a lightweight conversion - some fields may be missing
    return metadata as unknown as Session;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw sessionNotFoundError(sessionId);
    }
    throw error;
  }
}

/**
 * Find audio segment by ID within a session
 */
export function findAudioSegment(
  session: Session,
  segmentId: string
): SessionAudioSegment {
  const validation = validateSegmentId(segmentId);
  if (!validation.valid) {
    throw new Error(`Invalid segment ID: ${validation.errors.join(', ')}`);
  }

  if (!session.audioSegments || session.audioSegments.length === 0) {
    throw noAudioSegmentsError(session.id);
  }

  const segment = session.audioSegments.find(s => s.id === segmentId);

  if (!segment) {
    throw segmentNotFoundError(segmentId, session.id);
  }

  return segment;
}

/**
 * Find screenshot by ID within a session
 */
export function findScreenshot(
  session: Session,
  screenshotId: string
): SessionScreenshot {
  const validation = validateScreenshotId(screenshotId);
  if (!validation.valid) {
    throw new Error(`Invalid screenshot ID: ${validation.errors.join(', ')}`);
  }

  const screenshot = session.screenshots.find(s => s.id === screenshotId);

  if (!screenshot) {
    throw screenshotNotFoundError(screenshotId, session.id);
  }

  return screenshot;
}

/**
 * Get audio segments within a time range
 */
export function getAudioSegmentsInRange(
  session: Session,
  startTime: number,
  endTime: number
): SessionAudioSegment[] {
  if (!session.audioSegments || session.audioSegments.length === 0) {
    logWarning('SessionLoader', `No audio segments in session ${session.id}`);
    return [];
  }

  // Calculate session start time
  const sessionStartTime = new Date(session.startTime).getTime();

  // Filter segments within range
  const segmentsInRange = session.audioSegments.filter(segment => {
    const segmentTime = new Date(segment.timestamp).getTime();
    const relativeTime = (segmentTime - sessionStartTime) / 1000; // Convert to seconds
    const segmentEnd = relativeTime + segment.duration;

    // Segment overlaps with range if:
    // - Segment starts before range ends AND segment ends after range starts
    return relativeTime < endTime && segmentEnd > startTime;
  });

  logInfo('SessionLoader', `Found ${segmentsInRange.length} segments in range ${startTime}s - ${endTime}s`);

  return segmentsInRange;
}

/**
 * Get screenshots within a time range
 */
export function getScreenshotsInRange(
  session: Session,
  startTime: number,
  endTime: number
): SessionScreenshot[] {
  if (!session.screenshots || session.screenshots.length === 0) {
    logWarning('SessionLoader', `No screenshots in session ${session.id}`);
    return [];
  }

  // Calculate session start time
  const sessionStartTime = new Date(session.startTime).getTime();

  // Filter screenshots within range
  const screenshotsInRange = session.screenshots.filter(screenshot => {
    const screenshotTime = new Date(screenshot.timestamp).getTime();
    const relativeTime = (screenshotTime - sessionStartTime) / 1000; // Convert to seconds

    return relativeTime >= startTime && relativeTime <= endTime;
  });

  logInfo('SessionLoader', `Found ${screenshotsInRange.length} screenshots in range ${startTime}s - ${endTime}s`);

  return screenshotsInRange;
}

/**
 * Calculate session duration in seconds
 */
export function getSessionDuration(session: Session): number {
  if (session.totalDuration) {
    return session.totalDuration;
  }

  if (session.endTime) {
    const start = new Date(session.startTime).getTime();
    const end = new Date(session.endTime).getTime();
    return (end - start) / 1000;
  }

  // Session still active or no end time
  const start = new Date(session.startTime).getTime();
  const now = Date.now();
  return (now - start) / 1000;
}

/**
 * Get relative timestamp (seconds from session start)
 */
export function getRelativeTimestamp(session: Session, absoluteTimestamp: string): number {
  const sessionStart = new Date(session.startTime).getTime();
  const timestamp = new Date(absoluteTimestamp).getTime();
  return (timestamp - sessionStart) / 1000;
}

/**
 * Get absolute timestamp from relative time
 */
export function getAbsoluteTimestamp(session: Session, relativeTime: number): string {
  const sessionStart = new Date(session.startTime).getTime();
  const absoluteTime = sessionStart + (relativeTime * 1000);
  return new Date(absoluteTime).toISOString();
}

/**
 * Validate time range is within session duration
 */
export function validateTimeRangeWithinSession(
  session: Session,
  startTime: number,
  endTime: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const duration = getSessionDuration(session);

  if (startTime < 0) {
    errors.push(`start_time cannot be negative: ${startTime}`);
  }

  if (endTime > duration) {
    errors.push(`end_time (${endTime}s) exceeds session duration (${duration}s)`);
  }

  if (startTime >= endTime) {
    errors.push(`start_time (${startTime}s) must be less than end_time (${endTime}s)`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if session has audio recording
 */
export function hasAudioRecording(session: Session): boolean {
  return !!session.audioSegments && session.audioSegments.length > 0;
}

/**
 * Check if session has video recording
 */
export function hasVideoRecording(session: Session): boolean {
  return !!session.video && !!session.video.optimizedPath;
}

/**
 * Get video path for session
 */
export function getVideoPath(session: Session): string | null {
  if (!session.video) {
    return null;
  }

  // Prefer optimized path (background-processed MP4)
  if (session.video.optimizedPath) {
    return session.video.optimizedPath;
  }

  // Fallback to legacy fullVideoAttachmentId path
  // Note: This requires loading from ContentAddressableStorage
  return null;
}
