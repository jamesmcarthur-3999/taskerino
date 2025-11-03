/**
 * AI Tools Utilities
 *
 * Shared utilities for validation, error handling, and data loading.
 */

// Validation
export {
  validateSessionId,
  validateSegmentId,
  validateScreenshotId,
  validateTimestamp,
  validateTimeRange,
  validateAudioFormat,
  validateTranscriptFormat,
  validateMaxFrames,
  validateConfidence,
  validateNonEmptyString,
  combineValidationResults,
  throwIfInvalid
} from './validation';

export type { ValidationResult } from '../types';

// Error Handling
export {
  createToolError,
  withErrorHandling,
  sessionNotFoundError,
  screenshotNotFoundError,
  segmentNotFoundError,
  videoNotFoundError,
  noVideoRecordingError,
  noAudioSegmentsError,
  transcriptionServiceError,
  missingRequiredFieldError,
  invalidModeError,
  audioDataNotFoundError,
  invalidTimeRangeError,
  storageError,
  videoFrameExtractionError,
  suggestionNotFoundError,
  alreadyExistsError,
  logInfo,
  logWarning,
  logError
} from './errorHandling';

// Session Loading
export {
  loadSession,
  loadSessionMetadata,
  findScreenshot,
  findAudioSegment,
  getAudioSegmentsInRange,
  getRelativeTimestamp,
  getSessionDuration,
  hasAudioRecording,
  hasVideoRecording
} from './sessionLoader';

// Audio Loading
export {
  loadSegmentAudio,
  loadTimeRangeAudio,
  loadFullSessionAudio,
  generateWaveform
} from './audioLoader';

// Video Loading
export {
  extractFrame,
  extractFrames,
  extractFramesByInterval,
  getVideoMetadata,
  validateTimestampInVideo,
  calculateOptimalInterval,
  estimateFrameMemory
} from './videoLoader';
