/**
 * Validation Utilities
 *
 * Comprehensive input validation for all AI tools.
 * Ensures data integrity and provides clear error messages.
 */

import type { ValidationResult, AudioFormat, VideoFormat, TranscriptFormat } from '../types';

/**
 * Validate session ID format
 */
export function validateSessionId(sessionId: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof sessionId !== 'string') {
    errors.push(`Session ID must be a string, got ${typeof sessionId}`);
    return { valid: false, errors };
  }

  if (!sessionId.trim()) {
    errors.push('Session ID cannot be empty');
  }

  if (sessionId.length < 5) {
    errors.push(`Session ID too short: ${sessionId.length} characters (minimum 5)`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate segment ID format
 */
export function validateSegmentId(segmentId: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof segmentId !== 'string') {
    errors.push(`Segment ID must be a string, got ${typeof segmentId}`);
    return { valid: false, errors };
  }

  if (!segmentId.trim()) {
    errors.push('Segment ID cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate screenshot ID format
 */
export function validateScreenshotId(screenshotId: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof screenshotId !== 'string') {
    errors.push(`Screenshot ID must be a string, got ${typeof screenshotId}`);
    return { valid: false, errors };
  }

  if (!screenshotId.trim()) {
    errors.push('Screenshot ID cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate timestamp (seconds from session start)
 */
export function validateTimestamp(timestamp: unknown, fieldName: string = 'timestamp'): ValidationResult {
  const errors: string[] = [];

  if (typeof timestamp !== 'number') {
    errors.push(`${fieldName} must be a number, got ${typeof timestamp}`);
    return { valid: false, errors };
  }

  if (isNaN(timestamp)) {
    errors.push(`${fieldName} is NaN`);
  }

  if (timestamp < 0) {
    errors.push(`${fieldName} cannot be negative: ${timestamp}`);
  }

  if (!isFinite(timestamp)) {
    errors.push(`${fieldName} must be finite: ${timestamp}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate time range
 */
export function validateTimeRange(startTime: number, endTime: number): ValidationResult {
  const errors: string[] = [];

  const startValidation = validateTimestamp(startTime, 'start_time');
  const endValidation = validateTimestamp(endTime, 'end_time');

  errors.push(...startValidation.errors, ...endValidation.errors);

  if (errors.length === 0 && endTime <= startTime) {
    errors.push(`end_time (${endTime}) must be greater than start_time (${startTime})`);
  }

  if (errors.length === 0 && (endTime - startTime) > 7200) {
    // Warn if range > 2 hours
    return {
      valid: true,
      errors: [],
      warnings: [`Time range is very large: ${(endTime - startTime) / 60} minutes. This may be slow.`]
    };
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate audio format
 */
export function validateAudioFormat(format: unknown): ValidationResult {
  const errors: string[] = [];
  const validFormats: AudioFormat[] = ['wav', 'mp3'];

  if (typeof format !== 'string') {
    errors.push(`Audio format must be a string, got ${typeof format}`);
    return { valid: false, errors };
  }

  if (!validFormats.includes(format as AudioFormat)) {
    errors.push(`Invalid audio format: ${format}. Valid formats: ${validFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate video format
 */
export function validateVideoFormat(format: unknown): ValidationResult {
  const errors: string[] = [];
  const validFormats: VideoFormat[] = ['mp4', 'mov'];

  if (typeof format !== 'string') {
    errors.push(`Video format must be a string, got ${typeof format}`);
    return { valid: false, errors };
  }

  if (!validFormats.includes(format as VideoFormat)) {
    errors.push(`Invalid video format: ${format}. Valid formats: ${validFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate transcript format
 */
export function validateTranscriptFormat(format: unknown): ValidationResult {
  const errors: string[] = [];
  const validFormats: TranscriptFormat[] = ['plain', 'srt', 'vtt', 'json'];

  if (typeof format !== 'string') {
    errors.push(`Transcript format must be a string, got ${typeof format}`);
    return { valid: false, errors };
  }

  if (!validFormats.includes(format as TranscriptFormat)) {
    errors.push(`Invalid transcript format: ${format}. Valid formats: ${validFormats.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate confidence score
 */
export function validateConfidence(confidence: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof confidence !== 'number') {
    errors.push(`Confidence must be a number, got ${typeof confidence}`);
    return { valid: false, errors };
  }

  if (isNaN(confidence)) {
    errors.push('Confidence is NaN');
  }

  if (confidence < 0 || confidence > 1) {
    errors.push(`Confidence must be between 0 and 1, got ${confidence}`);
  }

  if (confidence < 0.5) {
    return {
      valid: true,
      errors: [],
      warnings: [`Low confidence score: ${confidence}. Consider reviewing this operation.`]
    };
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate max frames limit
 */
export function validateMaxFrames(maxFrames: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof maxFrames !== 'number') {
    errors.push(`max_frames must be a number, got ${typeof maxFrames}`);
    return { valid: false, errors };
  }

  if (isNaN(maxFrames)) {
    errors.push('max_frames is NaN');
  }

  if (maxFrames < 1) {
    errors.push(`max_frames must be at least 1, got ${maxFrames}`);
  }

  if (maxFrames > 100) {
    errors.push(`max_frames cannot exceed 100 (performance limit), got ${maxFrames}`);
  }

  if (maxFrames > 50) {
    return {
      valid: true,
      errors: [],
      warnings: [`max_frames is high: ${maxFrames}. This may take significant time and memory.`]
    };
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate non-empty string
 */
export function validateNonEmptyString(value: unknown, fieldName: string): ValidationResult {
  const errors: string[] = [];

  if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string, got ${typeof value}`);
    return { valid: false, errors };
  }

  if (!value.trim()) {
    errors.push(`${fieldName} cannot be empty`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate priority level
 */
export function validatePriority(priority: unknown): ValidationResult {
  const errors: string[] = [];
  const validPriorities = ['low', 'medium', 'high', 'urgent'];

  if (typeof priority !== 'string') {
    errors.push(`Priority must be a string, got ${typeof priority}`);
    return { valid: false, errors };
  }

  if (!validPriorities.includes(priority)) {
    errors.push(`Invalid priority: ${priority}. Valid priorities: ${validPriorities.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate sentiment
 */
export function validateSentiment(sentiment: unknown): ValidationResult {
  const errors: string[] = [];
  const validSentiments = ['positive', 'neutral', 'negative'];

  if (typeof sentiment !== 'string') {
    errors.push(`Sentiment must be a string, got ${typeof sentiment}`);
    return { valid: false, errors };
  }

  if (!validSentiments.includes(sentiment)) {
    errors.push(`Invalid sentiment: ${sentiment}. Valid sentiments: ${validSentiments.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Combine multiple validation results
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const result of results) {
    allErrors.push(...result.errors);
    if (result.warnings) {
      allWarnings.push(...result.warnings);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings.length > 0 ? allWarnings : undefined
  };
}

/**
 * Throw validation error if invalid
 */
export function throwIfInvalid(result: ValidationResult, context: string): void {
  if (!result.valid) {
    throw new Error(`Validation failed for ${context}: ${result.errors.join(', ')}`);
  }
}
