/**
 * getTranscript Tool
 *
 * Retrieves transcript data from sessions in multiple modes:
 * - segments: Get audio segments with transcriptions (filtered by time/quality)
 * - full_transcript: Get complete session transcript in various formats
 *
 * Returns structured transcript data or formatted text.
 */

import type {
  GetTranscriptInput,
  GetTranscriptOutput,
  ToolExecutionResult
} from '../types';
import type { SessionAudioSegment } from '../../../types';
import {
  loadSession,
  getAudioSegmentsInRange,
  getSessionDuration
} from '../utils/sessionLoader';
import {
  validateSessionId,
  validateTimeRange,
  validateTranscriptFormat,
  validateNonEmptyString,
  combineValidationResults,
  throwIfInvalid
} from '../utils/validation';
import {
  missingRequiredFieldError,
  invalidModeError,
  noAudioSegmentsError,
  withErrorHandling,
  logInfo,
  logWarning
} from '../utils/errorHandling';

/**
 * Main tool execution function
 */
export async function getTranscript(
  input: GetTranscriptInput
): Promise<ToolExecutionResult<GetTranscriptOutput>> {
  const startTime = Date.now();

  const result = await withErrorHandling(
    async () => executeGetTranscript(input),
    {
      userMessage: 'Failed to retrieve transcript',
      toolName: 'getTranscript',
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
async function executeGetTranscript(input: GetTranscriptInput): Promise<GetTranscriptOutput> {
  // Validate session ID
  const sessionValidation = validateSessionId(input.session_id);
  throwIfInvalid(sessionValidation, 'session_id');

  // Route to appropriate handler based on mode
  switch (input.mode) {
    case 'segments':
      return await handleSegmentsMode(input);

    case 'full_transcript':
      return await handleFullTranscriptMode(input);

    default:
      throw invalidModeError(input.mode, ['segments', 'full_transcript']);
  }
}

/**
 * Handle segments mode
 * Returns array of audio segments with transcriptions
 */
async function handleSegmentsMode(input: GetTranscriptInput): Promise<GetTranscriptOutput> {
  logInfo('getTranscript', `Getting transcript segments for session: ${input.session_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  if (!session.audioSegments || session.audioSegments.length === 0) {
    throw noAudioSegmentsError(session.id);
  }

  let segments = session.audioSegments;

  // Apply time range filter if provided
  if (input.start_time !== undefined && input.end_time !== undefined) {
    const timeRangeValidation = validateTimeRange(input.start_time, input.end_time);
    throwIfInvalid(timeRangeValidation, 'time range');

    logInfo('getTranscript', `Filtering segments to time range: ${input.start_time}s - ${input.end_time}s`);
    segments = getAudioSegmentsInRange(session, input.start_time, input.end_time);
  }

  // Apply quality filter if provided
  if (input.quality_filter && input.quality_filter !== 'all') {
    const quality = input.quality_filter;
    logInfo('getTranscript', `Filtering segments by quality: ${quality}`);

    segments = segments.filter(seg => {
      if (quality === 'draft') {
        return seg.transcriptionQuality === 'draft' || !seg.transcriptionQuality;
      } else if (quality === 'final') {
        return seg.transcriptionQuality === 'final';
      }
      return true;
    });
  }

  // Calculate total duration
  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);

  // Count total words (approximate)
  const wordCount = segments.reduce((sum, seg) => {
    return sum + (seg.transcription?.split(/\s+/).length || 0);
  }, 0);

  logInfo('getTranscript', `Returning ${segments.length} segments (${totalDuration.toFixed(1)}s, ~${wordCount} words)`);

  return {
    segments,
    total_duration: totalDuration,
    word_count: wordCount,
    segment_count: segments.length
  };
}

/**
 * Handle full_transcript mode
 * Returns complete transcript in requested format
 */
async function handleFullTranscriptMode(input: GetTranscriptInput): Promise<GetTranscriptOutput> {
  const format = input.format || 'plain';
  const quality = input.quality || 'best';

  // Validate format
  const formatValidation = validateTranscriptFormat(format);
  throwIfInvalid(formatValidation, 'format');

  logInfo('getTranscript', `Getting full transcript (format: ${format}, quality: ${quality})`);

  // Load session
  const session = await loadSession(input.session_id);

  if (!session.audioSegments || session.audioSegments.length === 0) {
    throw noAudioSegmentsError(session.id);
  }

  // Select segments based on quality preference
  const segments = selectSegmentsByQuality(session.audioSegments, quality);

  // Generate transcript in requested format
  const transcript = formatTranscript(session, segments, format);

  // Calculate stats
  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
  const wordCount = countWords(transcript);

  logInfo('getTranscript', `Generated ${format} transcript: ${wordCount} words, ${totalDuration.toFixed(1)}s`);

  return {
    transcript,
    format,
    total_duration: totalDuration,
    word_count: wordCount,
    segment_count: segments.length
  };
}

/**
 * Select segments based on quality preference
 */
function selectSegmentsByQuality(
  segments: SessionAudioSegment[],
  quality: 'draft' | 'final' | 'best'
): SessionAudioSegment[] {
  if (quality === 'draft') {
    // Use draft transcriptions only
    return segments.map(seg => ({
      ...seg,
      transcription: seg.draftTranscription || seg.transcription
    }));
  } else if (quality === 'final') {
    // Only return segments with final transcriptions
    return segments.filter(seg => seg.transcriptionQuality === 'final');
  } else {
    // Best: prefer final, fallback to draft
    return segments.map(seg => {
      if (seg.transcriptionQuality === 'final') {
        return seg;
      } else {
        return seg;
      }
    });
  }
}

/**
 * Format transcript in requested format
 */
function formatTranscript(
  session: any,
  segments: SessionAudioSegment[],
  format: 'plain' | 'srt' | 'vtt' | 'json'
): string {
  switch (format) {
    case 'plain':
      return formatPlainText(segments);

    case 'srt':
      return formatSRT(session, segments);

    case 'vtt':
      return formatVTT(session, segments);

    case 'json':
      return formatJSON(segments);

    default:
      return formatPlainText(segments);
  }
}

/**
 * Format as plain text
 */
function formatPlainText(segments: SessionAudioSegment[]): string {
  return segments
    .map(seg => seg.transcription)
    .filter(Boolean)
    .join(' ');
}

/**
 * Format as SRT (SubRip subtitle format)
 */
function formatSRT(session: any, segments: SessionAudioSegment[]): string {
  const sessionStartTime = new Date(session.startTime).getTime();
  let srt = '';
  let index = 1;

  for (const segment of segments) {
    if (!segment.transcription) continue;

    // Calculate relative time
    const segmentTime = new Date(segment.timestamp).getTime();
    const startSeconds = (segmentTime - sessionStartTime) / 1000;
    const endSeconds = startSeconds + segment.duration;

    // Format timestamps (SRT uses HH:MM:SS,mmm)
    const startTime = formatSRTTimestamp(startSeconds);
    const endTime = formatSRTTimestamp(endSeconds);

    srt += `${index}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${segment.transcription}\n\n`;

    index++;
  }

  return srt;
}

/**
 * Format as WebVTT
 */
function formatVTT(session: any, segments: SessionAudioSegment[]): string {
  const sessionStartTime = new Date(session.startTime).getTime();
  let vtt = 'WEBVTT\n\n';

  for (const segment of segments) {
    if (!segment.transcription) continue;

    // Calculate relative time
    const segmentTime = new Date(segment.timestamp).getTime();
    const startSeconds = (segmentTime - sessionStartTime) / 1000;
    const endSeconds = startSeconds + segment.duration;

    // Format timestamps (VTT uses HH:MM:SS.mmm)
    const startTime = formatVTTTimestamp(startSeconds);
    const endTime = formatVTTTimestamp(endSeconds);

    vtt += `${startTime} --> ${endTime}\n`;
    vtt += `${segment.transcription}\n\n`;
  }

  return vtt;
}

/**
 * Format as JSON
 */
function formatJSON(segments: SessionAudioSegment[]): string {
  const data = segments.map(seg => ({
    id: seg.id,
    timestamp: seg.timestamp,
    duration: seg.duration,
    transcription: seg.transcription,
    transcriptionQuality: seg.transcriptionQuality,
    keyPhrases: seg.keyPhrases,
    sentiment: seg.sentiment,
    containsTask: seg.containsTask,
    containsBlocker: seg.containsBlocker
  }));

  return JSON.stringify(data, null, 2);
}

/**
 * Format timestamp for SRT (HH:MM:SS,mmm)
 */
function formatSRTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format timestamp for VTT (HH:MM:SS.mmm)
 */
function formatVTTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Count words in transcript
 */
function countWords(text: string): number {
  if (typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Export for use in tool executor
 */
export default getTranscript;
