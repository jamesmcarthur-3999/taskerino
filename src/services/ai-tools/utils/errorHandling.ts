/**
 * Error Handling Utilities
 *
 * Consistent error handling patterns for all AI tools.
 * Provides user-friendly messages while preserving technical details for debugging.
 */

import { ToolExecutionError } from '../types';

/**
 * Create a ToolExecutionError with consistent formatting
 */
export function createToolError(
  userMessage: string,
  error: unknown,
  context?: Record<string, any>
): ToolExecutionError {
  const errorDetails = {
    error: error instanceof Error ? error.message : String(error),
    code: (error as any)?.code,
    stack: error instanceof Error ? error.stack : undefined,
    context: context || {}
  };

  return new ToolExecutionError(userMessage, errorDetails);
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext: {
    userMessage: string;
    toolName: string;
    context?: Record<string, any>;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[${errorContext.toolName}] Error:`, error);
    throw createToolError(
      errorContext.userMessage,
      error,
      {
        tool: errorContext.toolName,
        ...errorContext.context
      }
    );
  }
}

/**
 * Session not found error
 */
export function sessionNotFoundError(sessionId: string): ToolExecutionError {
  return new ToolExecutionError(
    `Session not found: ${sessionId}`,
    {
      error: 'SessionNotFound',
      code: 'SESSION_NOT_FOUND',
      context: { sessionId }
    }
  );
}

/**
 * Segment not found error
 */
export function segmentNotFoundError(segmentId: string, sessionId?: string): ToolExecutionError {
  return new ToolExecutionError(
    `Audio segment not found: ${segmentId}`,
    {
      error: 'SegmentNotFound',
      code: 'SEGMENT_NOT_FOUND',
      context: { segmentId, sessionId }
    }
  );
}

/**
 * Screenshot not found error
 */
export function screenshotNotFoundError(screenshotId: string, sessionId?: string): ToolExecutionError {
  return new ToolExecutionError(
    `Screenshot not found: ${screenshotId}`,
    {
      error: 'ScreenshotNotFound',
      code: 'SCREENSHOT_NOT_FOUND',
      context: { screenshotId, sessionId }
    }
  );
}

/**
 * Audio data not found error
 */
export function audioDataNotFoundError(identifier: string): ToolExecutionError {
  return new ToolExecutionError(
    `Audio data not found for segment`,
    {
      error: 'AudioDataNotFound',
      code: 'AUDIO_DATA_NOT_FOUND',
      context: { identifier }
    }
  );
}

/**
 * Video not found error
 */
export function videoNotFoundError(sessionId: string): ToolExecutionError {
  return new ToolExecutionError(
    `No video recording found for session`,
    {
      error: 'VideoNotFound',
      code: 'VIDEO_NOT_FOUND',
      context: { sessionId }
    }
  );
}

/**
 * Invalid time range error
 */
export function invalidTimeRangeError(startTime: number, endTime: number, sessionDuration: number): ToolExecutionError {
  return new ToolExecutionError(
    `Invalid time range: ${startTime}s - ${endTime}s (session duration: ${sessionDuration}s)`,
    {
      error: 'InvalidTimeRange',
      code: 'INVALID_TIME_RANGE',
      context: { startTime, endTime, sessionDuration }
    }
  );
}

/**
 * No audio segments error
 */
export function noAudioSegmentsError(sessionId: string): ToolExecutionError {
  return new ToolExecutionError(
    `Session has no audio segments`,
    {
      error: 'NoAudioSegments',
      code: 'NO_AUDIO_SEGMENTS',
      context: { sessionId }
    }
  );
}

/**
 * No video recording error
 */
export function noVideoRecordingError(sessionId: string): ToolExecutionError {
  return new ToolExecutionError(
    `Session has no video recording`,
    {
      error: 'NoVideoRecording',
      code: 'NO_VIDEO_RECORDING',
      context: { sessionId }
    }
  );
}

/**
 * Invalid mode error
 */
export function invalidModeError(mode: string, validModes: string[]): ToolExecutionError {
  return new ToolExecutionError(
    `Invalid mode: ${mode}. Valid modes: ${validModes.join(', ')}`,
    {
      error: 'InvalidMode',
      code: 'INVALID_MODE',
      context: { mode, validModes }
    }
  );
}

/**
 * Missing required field error
 */
export function missingRequiredFieldError(fieldName: string, mode: string): ToolExecutionError {
  return new ToolExecutionError(
    `Missing required field: ${fieldName} (required for mode: ${mode})`,
    {
      error: 'MissingRequiredField',
      code: 'MISSING_REQUIRED_FIELD',
      context: { fieldName, mode }
    }
  );
}

/**
 * Transcription service error
 */
export function transcriptionServiceError(error: unknown, context?: Record<string, any>): ToolExecutionError {
  return createToolError(
    'Failed to transcribe audio. Please check your OpenAI API key and try again.',
    error,
    context
  );
}

/**
 * Storage error
 */
export function storageError(operation: string, error: unknown, context?: Record<string, any>): ToolExecutionError {
  return createToolError(
    `Storage operation failed: ${operation}`,
    error,
    context
  );
}

/**
 * Video frame extraction error
 */
export function videoFrameExtractionError(timestamp: number, error: unknown): ToolExecutionError {
  return createToolError(
    `Failed to extract video frame at ${timestamp}s`,
    error,
    { timestamp }
  );
}

/**
 * Suggestion not found error
 */
export function suggestionNotFoundError(suggestionId: string): ToolExecutionError {
  return new ToolExecutionError(
    `Suggestion not found: ${suggestionId}`,
    {
      error: 'SuggestionNotFound',
      code: 'SUGGESTION_NOT_FOUND',
      context: { suggestionId }
    }
  );
}

/**
 * Already exists error
 */
export function alreadyExistsError(itemType: string, identifier: string): ToolExecutionError {
  return new ToolExecutionError(
    `${itemType} already exists: ${identifier}`,
    {
      error: 'AlreadyExists',
      code: 'ALREADY_EXISTS',
      context: { itemType, identifier }
    }
  );
}

/**
 * Log error with context
 */
export function logError(toolName: string, error: unknown, context?: Record<string, any>): void {
  console.error(`[${toolName}] Error:`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context
  });
}

/**
 * Log warning
 */
export function logWarning(toolName: string, message: string, context?: Record<string, any>): void {
  console.warn(`[${toolName}] Warning:`, message, context);
}

/**
 * Log info
 */
export function logInfo(toolName: string, message: string, context?: Record<string, any>): void {
  console.log(`[${toolName}] ${message}`, context);
}
