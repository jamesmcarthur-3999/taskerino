/**
 * getVideoData Tool
 *
 * Retrieves video data from sessions in multiple modes:
 * - frames_at_timestamps: Extract frames at specific timestamps
 * - frames_by_interval: Extract frames at regular intervals
 * - metadata: Get video file metadata
 *
 * Returns base64-encoded PNG frames or video metadata.
 */

import type {
  GetVideoDataInput,
  GetVideoDataOutput,
  ToolExecutionResult
} from '../types';
import {
  loadSession,
  getSessionDuration
} from '../utils/sessionLoader';
import {
  extractFrames,
  extractFramesByInterval,
  getVideoMetadata,
  validateTimestampInVideo,
  calculateOptimalInterval,
  estimateFrameMemory
} from '../utils/videoLoader';
import {
  validateSessionId,
  validateTimestamp,
  validateMaxFrames,
  combineValidationResults,
  throwIfInvalid
} from '../utils/validation';
import {
  missingRequiredFieldError,
  invalidModeError,
  withErrorHandling,
  logInfo,
  logWarning
} from '../utils/errorHandling';

/**
 * Main tool execution function
 */
export async function getVideoData(
  input: GetVideoDataInput
): Promise<ToolExecutionResult<GetVideoDataOutput>> {
  const startTime = Date.now();

  const result = await withErrorHandling(
    async () => executeGetVideoData(input),
    {
      userMessage: 'Failed to retrieve video data',
      toolName: 'getVideoData',
      context: { mode: input.mode, session_id: input.session_id }
    }
  );

  const executionTime = Date.now() - startTime;

  return {
    success: true,
    data: result,
    metadata: {
      executionTime,
      mode: input.mode
    }
  };
}

/**
 * Core execution logic
 */
async function executeGetVideoData(input: GetVideoDataInput): Promise<GetVideoDataOutput> {
  // Validate session ID
  const sessionValidation = validateSessionId(input.session_id);
  throwIfInvalid(sessionValidation, 'session_id');

  // Route to appropriate handler based on mode
  switch (input.mode) {
    case 'frames_at_timestamps':
      return await handleFramesAtTimestampsMode(input);

    case 'frames_by_interval':
      return await handleFramesByIntervalMode(input);

    case 'metadata':
      return await handleMetadataMode(input);

    default:
      throw invalidModeError(input.mode, ['frames_at_timestamps', 'frames_by_interval', 'metadata']);
  }
}

/**
 * Handle frames_at_timestamps mode
 */
async function handleFramesAtTimestampsMode(
  input: GetVideoDataInput
): Promise<GetVideoDataOutput> {
  if (!input.timestamps || input.timestamps.length === 0) {
    throw missingRequiredFieldError('timestamps', 'frames_at_timestamps');
  }

  // Validate max_frames if provided
  const maxFrames = input.max_frames || 50;
  const maxFramesValidation = validateMaxFrames(maxFrames);
  throwIfInvalid(maxFramesValidation, 'max_frames');

  // Limit timestamps to max_frames
  const timestamps = input.timestamps.slice(0, maxFrames);

  if (timestamps.length < input.timestamps.length) {
    logWarning('getVideoData', `Trimmed timestamps from ${input.timestamps.length} to ${timestamps.length} (max_frames limit)`);
  }

  // Validate each timestamp
  for (const timestamp of timestamps) {
    const validation = validateTimestamp(timestamp, 'timestamp');
    throwIfInvalid(validation, `timestamp ${timestamp}`);
  }

  logInfo('getVideoData', `Extracting ${timestamps.length} frames at specific timestamps`);

  // Load session
  const session = await loadSession(input.session_id);

  // Validate timestamps are within video duration
  const duration = getSessionDuration(session);
  for (const timestamp of timestamps) {
    const validation = validateTimestampInVideo(session, timestamp);
    if (!validation.valid) {
      throw new Error(`Timestamp ${timestamp}s exceeds video duration (${duration}s)`);
    }
  }

  // Estimate memory usage
  const memoryEstimate = estimateFrameMemory(timestamps.length);
  if (memoryEstimate.megabytes > 100) {
    logWarning('getVideoData', `Large memory usage estimated: ${memoryEstimate.megabytes.toFixed(1)}MB`);
  }

  // Extract frames
  const frames = await extractFrames(session, timestamps);

  return {
    frames: frames.map(f => ({
      timestamp: f.timestamp,
      data_uri: f.data_uri,
      width: f.width,
      height: f.height
    }))
  };
}

/**
 * Handle frames_by_interval mode
 */
async function handleFramesByIntervalMode(
  input: GetVideoDataInput
): Promise<GetVideoDataOutput> {
  if (input.interval_seconds === undefined) {
    throw missingRequiredFieldError('interval_seconds', 'frames_by_interval');
  }

  // Validate interval
  const intervalValidation = validateTimestamp(input.interval_seconds, 'interval_seconds');
  throwIfInvalid(intervalValidation, 'interval_seconds');

  if (input.interval_seconds < 1) {
    throw new Error('interval_seconds must be at least 1 second');
  }

  if (input.interval_seconds > 300) {
    logWarning('getVideoData', `Large interval: ${input.interval_seconds}s. Will result in few frames.`);
  }

  // Validate max_frames if provided
  const maxFrames = input.max_frames || 50;
  const maxFramesValidation = validateMaxFrames(maxFrames);
  throwIfInvalid(maxFramesValidation, 'max_frames');

  logInfo('getVideoData', `Extracting frames at ${input.interval_seconds}s intervals (max: ${maxFrames})`);

  // Load session
  const session = await loadSession(input.session_id);

  // Calculate how many frames this will generate
  const duration = getSessionDuration(session);
  const estimatedFrames = Math.min(
    Math.ceil(duration / input.interval_seconds) + 1,
    maxFrames
  );

  logInfo('getVideoData', `Estimated ${estimatedFrames} frames for ${duration.toFixed(1)}s video`);

  // Estimate memory usage
  const memoryEstimate = estimateFrameMemory(estimatedFrames);
  if (memoryEstimate.megabytes > 100) {
    logWarning('getVideoData', `Large memory usage estimated: ${memoryEstimate.megabytes.toFixed(1)}MB`);
  }

  // Extract frames
  const frames = await extractFramesByInterval(session, input.interval_seconds, maxFrames);

  return {
    frames: frames.map(f => ({
      timestamp: f.timestamp,
      data_uri: f.data_uri,
      width: f.width,
      height: f.height
    }))
  };
}

/**
 * Handle metadata mode
 */
async function handleMetadataMode(
  input: GetVideoDataInput
): Promise<GetVideoDataOutput> {
  logInfo('getVideoData', `Getting video metadata for session: ${input.session_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Get metadata
  const metadata = await getVideoMetadata(session);

  return {
    metadata: {
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      codec: metadata.codec,
      file_size: metadata.file_size,
      path: metadata.path
    }
  };
}

/**
 * Export for use in tool executor
 */
export default getVideoData;
