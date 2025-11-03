/**
 * getAudioData Tool
 *
 * Retrieves audio data from sessions in multiple modes:
 * - single segment: Load specific audio segment by ID
 * - time_range: Extract audio for a time range
 * - full_session: Get complete session audio
 *
 * Returns base64-encoded audio data (WAV or MP3) with metadata.
 */

import type {
  GetAudioDataInput,
  GetAudioDataOutput,
  ToolExecutionResult
} from '../types';
import {
  loadSession,
  findAudioSegment,
  getSessionDuration,
  validateTimeRangeWithinSession,
  hasAudioRecording
} from '../utils/sessionLoader';
import {
  loadSegmentAudio,
  loadTimeRangeAudio,
  loadFullSessionAudio,
  generateWaveform
} from '../utils/audioLoader';
import {
  validateSessionId,
  validateSegmentId,
  validateTimeRange,
  validateAudioFormat,
  combineValidationResults,
  throwIfInvalid
} from '../utils/validation';
import {
  missingRequiredFieldError,
  invalidModeError,
  invalidTimeRangeError,
  withErrorHandling,
  logInfo
} from '../utils/errorHandling';

/**
 * Main tool execution function
 */
export async function getAudioData(
  input: GetAudioDataInput
): Promise<ToolExecutionResult<GetAudioDataOutput>> {
  const startTime = Date.now();

  const result = await withErrorHandling(
    async () => executeGetAudioData(input),
    {
      userMessage: 'Failed to retrieve audio data',
      toolName: 'getAudioData',
      context: { mode: input.mode, session_id: input.session_id }
    }
  );

  const executionTime = Date.now() - startTime;

  return {
    success: true,
    data: result,
    metadata: {
      executionTime,
      mode: input.mode,
      format: input.format || 'mp3'
    }
  };
}

/**
 * Core execution logic
 */
async function executeGetAudioData(input: GetAudioDataInput): Promise<GetAudioDataOutput> {
  // Validate common fields
  const sessionValidation = validateSessionId(input.session_id);
  throwIfInvalid(sessionValidation, 'session_id');

  // Validate format if provided
  const format = input.format || 'mp3';
  const formatValidation = validateAudioFormat(format);
  throwIfInvalid(formatValidation, 'format');

  // Route to appropriate handler based on mode
  switch (input.mode) {
    case 'segment':
      return await handleSegmentMode(input, format);

    case 'time_range':
      return await handleTimeRangeMode(input, format);

    case 'full_session':
      return await handleFullSessionMode(input, format);

    default:
      throw invalidModeError(input.mode, ['segment', 'time_range', 'full_session']);
  }
}

/**
 * Handle segment mode
 */
async function handleSegmentMode(
  input: GetAudioDataInput,
  format: 'wav' | 'mp3'
): Promise<GetAudioDataOutput> {
  if (!input.segment_id) {
    throw missingRequiredFieldError('segment_id', 'segment');
  }

  const segmentValidation = validateSegmentId(input.segment_id);
  throwIfInvalid(segmentValidation, 'segment_id');

  logInfo('getAudioData', `Loading audio for segment: ${input.segment_id}`);

  // Load session to find segment
  const session = await loadSession(input.session_id);

  // Find the segment
  const segment = findAudioSegment(session, input.segment_id);

  // Load audio data
  const audioData = await loadSegmentAudio(segment, format);

  // Generate waveform if requested
  let waveformData: number[] | undefined;
  if (input.include_waveform) {
    waveformData = await generateWaveform(audioData.audioBase64, 100);
  }

  return {
    audio_base64: audioData.audioBase64,
    format,
    duration: audioData.duration,
    sample_rate: audioData.sampleRate,
    channels: audioData.channels,
    waveform_data: waveformData,
    segments: [segment]
  };
}

/**
 * Handle time_range mode
 */
async function handleTimeRangeMode(
  input: GetAudioDataInput,
  format: 'wav' | 'mp3'
): Promise<GetAudioDataOutput> {
  if (input.start_time === undefined || input.end_time === undefined) {
    throw missingRequiredFieldError('start_time and end_time', 'time_range');
  }

  // Validate time range
  const timeRangeValidation = validateTimeRange(input.start_time, input.end_time);
  throwIfInvalid(timeRangeValidation, 'time range');

  logInfo('getAudioData', `Loading audio for time range: ${input.start_time}s - ${input.end_time}s`);

  // Load session
  const session = await loadSession(input.session_id);

  // Validate range is within session duration
  const rangeValidation = validateTimeRangeWithinSession(
    session,
    input.start_time,
    input.end_time
  );

  if (!rangeValidation.valid) {
    const duration = getSessionDuration(session);
    throw invalidTimeRangeError(input.start_time, input.end_time, duration);
  }

  // Load audio for time range
  const audioData = await loadTimeRangeAudio(
    session,
    input.start_time,
    input.end_time,
    format
  );

  // Generate waveform if requested
  let waveformData: number[] | undefined;
  if (input.include_waveform) {
    waveformData = await generateWaveform(audioData.audioBase64, 100);
  }

  return {
    audio_base64: audioData.audioBase64,
    format,
    duration: audioData.duration,
    sample_rate: 16000,
    channels: 1,
    waveform_data: waveformData,
    segments: audioData.segments
  };
}

/**
 * Handle full_session mode
 */
async function handleFullSessionMode(
  input: GetAudioDataInput,
  format: 'wav' | 'mp3'
): Promise<GetAudioDataOutput> {
  logInfo('getAudioData', `Loading full session audio: ${input.session_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Load full audio
  const audioData = await loadFullSessionAudio(session, format);

  // Generate waveform if requested
  let waveformData: number[] | undefined;
  if (input.include_waveform) {
    waveformData = await generateWaveform(audioData.audioBase64, 100);
  }

  return {
    audio_base64: audioData.audioBase64,
    format,
    duration: audioData.duration,
    sample_rate: 16000,
    channels: 1,
    waveform_data: waveformData,
    segments: audioData.segments
  };
}

/**
 * Export for use in tool executor
 */
export default getAudioData;
