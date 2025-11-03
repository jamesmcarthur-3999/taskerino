/**
 * updateTranscript Tool
 *
 * Updates and corrects audio transcriptions with 5 modes:
 * 1. single_segment: Correct a single transcript segment
 * 2. batch_segments: Update multiple segments at once
 * 3. re_transcribe_segment: Re-run Whisper on a segment
 * 4. re_transcribe_range: Re-run Whisper on time range
 * 5. upgrade_all: Full session transcript upgrade
 *
 * This is the PRIMARY tool for AI agents to fix transcript errors.
 */

import type {
  UpdateTranscriptInput,
  UpdateTranscriptOutput,
  ToolExecutionResult
} from '../types';
import type { Session, SessionAudioSegment } from '../../../types';
import {
  loadSession,
  findAudioSegment,
  getAudioSegmentsInRange,
  getSessionDuration
} from '../utils/sessionLoader';
import {
  loadSegmentAudio,
  loadTimeRangeAudio,
  loadFullSessionAudio
} from '../utils/audioLoader';
import {
  validateSessionId,
  validateSegmentId,
  validateTimeRange,
  validateConfidence,
  validateNonEmptyString,
  combineValidationResults,
  throwIfInvalid
} from '../utils/validation';
import {
  missingRequiredFieldError,
  invalidModeError,
  transcriptionServiceError,
  withErrorHandling,
  logInfo,
  logWarning
} from '../utils/errorHandling';
import { getChunkedStorage } from '../../storage/ChunkedSessionStorage';
import { openAIService } from '../../openAIService';
import { transcriptUpgradeService } from '../../transcriptUpgradeService';

/**
 * Main tool execution function
 */
export async function updateTranscript(
  input: UpdateTranscriptInput
): Promise<ToolExecutionResult<UpdateTranscriptOutput>> {
  const startTime = Date.now();

  const result = await withErrorHandling(
    async () => executeUpdateTranscript(input),
    {
      userMessage: 'Failed to update transcript',
      toolName: 'updateTranscript',
      context: { mode: input.mode }
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
async function executeUpdateTranscript(
  input: UpdateTranscriptInput
): Promise<UpdateTranscriptOutput> {
  // Route to appropriate handler based on mode
  switch (input.mode) {
    case 'single_segment':
      return await handleSingleSegmentMode(input);

    case 'batch_segments':
      return await handleBatchSegmentsMode(input);

    case 're_transcribe_segment':
      return await handleReTranscribeSegmentMode(input);

    case 're_transcribe_range':
      return await handleReTranscribeRangeMode(input);

    case 'upgrade_all':
      return await handleUpgradeAllMode(input);

    default:
      throw invalidModeError(input.mode, [
        'single_segment',
        'batch_segments',
        're_transcribe_segment',
        're_transcribe_range',
        'upgrade_all'
      ]);
  }
}

/**
 * Handle single_segment mode
 * Update a single transcript segment with corrected text
 */
async function handleSingleSegmentMode(
  input: UpdateTranscriptInput
): Promise<UpdateTranscriptOutput> {
  if (!input.segment_id) {
    throw missingRequiredFieldError('segment_id', 'single_segment');
  }

  if (!input.corrected_transcription) {
    throw missingRequiredFieldError('corrected_transcription', 'single_segment');
  }

  if (!input.correction_reason) {
    throw missingRequiredFieldError('correction_reason', 'single_segment');
  }

  // Validate inputs
  const segmentValidation = validateSegmentId(input.segment_id);
  const transcriptionValidation = validateNonEmptyString(input.corrected_transcription, 'corrected_transcription');
  const reasonValidation = validateNonEmptyString(input.correction_reason, 'correction_reason');

  const combined = combineValidationResults(segmentValidation, transcriptionValidation, reasonValidation);
  throwIfInvalid(combined, 'single_segment inputs');

  // Validate confidence if provided
  if (input.confidence !== undefined) {
    const confidenceValidation = validateConfidence(input.confidence);
    throwIfInvalid(confidenceValidation, 'confidence');
  }

  logInfo('updateTranscript', `Correcting segment: ${input.segment_id}`);

  // Find the session containing this segment
  const session = await findSessionForSegment(input.segment_id);

  // Find the segment
  const segment = findAudioSegment(session, input.segment_id);

  // Store original as draft if not already stored
  const draftTranscription = segment.draftTranscription || segment.transcription;

  // Update the segment
  const updatedSegment: SessionAudioSegment = {
    ...segment,
    transcription: input.corrected_transcription,
    transcriptionQuality: 'final',
    draftTranscription,
  };

  // Update in session
  const updatedSession = {
    ...session,
    audioSegments: session.audioSegments!.map(s =>
      s.id === input.segment_id ? updatedSegment : s
    )
  };

  // Save to storage
  await saveSessionUpdates(updatedSession);

  logInfo('updateTranscript', `Corrected segment successfully`, {
    originalLength: segment.transcription?.length || 0,
    newLength: input.corrected_transcription.length,
    confidence: input.confidence
  });

  return {
    updated_segments: [updatedSegment],
    update_count: 1
  };
}

/**
 * Handle batch_segments mode
 * Update multiple segments at once
 */
async function handleBatchSegmentsMode(
  input: UpdateTranscriptInput
): Promise<UpdateTranscriptOutput> {
  if (!input.batch_updates || input.batch_updates.length === 0) {
    throw missingRequiredFieldError('batch_updates', 'batch_segments');
  }

  logInfo('updateTranscript', `Batch updating ${input.batch_updates.length} segments`);

  // Validate all updates
  for (const update of input.batch_updates) {
    const segmentValidation = validateSegmentId(update.segment_id);
    const transcriptionValidation = validateNonEmptyString(update.corrected_transcription, 'corrected_transcription');
    const reasonValidation = validateNonEmptyString(update.correction_reason, 'correction_reason');
    const confidenceValidation = validateConfidence(update.confidence);

    const combined = combineValidationResults(
      segmentValidation,
      transcriptionValidation,
      reasonValidation,
      confidenceValidation
    );

    throwIfInvalid(combined, `batch update for segment ${update.segment_id}`);
  }

  // Group updates by session (segments may be from different sessions)
  const updatesBySession = await groupUpdatesBySession(input.batch_updates);

  const allUpdatedSegments: SessionAudioSegment[] = [];
  const errors: Array<{ segment_id: string; error: string }> = [];

  // Process each session
  for (const [sessionId, updates] of Object.entries(updatesBySession)) {
    try {
      const session = await loadSession(sessionId);

      const updatedSegments = session.audioSegments!.map(segment => {
        const update = updates.find(u => u.segment_id === segment.id);

        if (!update) return segment;

        // Store original as draft
        const draftTranscription = segment.draftTranscription || segment.transcription;

        return {
          ...segment,
          transcription: update.corrected_transcription,
          transcriptionQuality: 'final' as const,
          draftTranscription,
        };
      });

      // Save session
      const updatedSession = {
        ...session,
        audioSegments: updatedSegments
      };

      await saveSessionUpdates(updatedSession);

      // Collect updated segments
      const changedSegments = updatedSegments.filter(s =>
        updates.some(u => u.segment_id === s.id)
      );

      allUpdatedSegments.push(...changedSegments);

    } catch (error) {
      // Track errors but continue with other sessions
      logWarning('updateTranscript', `Failed to update session ${sessionId}: ${error}`);
      for (const update of updates) {
        errors.push({
          segment_id: update.segment_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  logInfo('updateTranscript', `Batch update complete: ${allUpdatedSegments.length} success, ${errors.length} errors`);

  return {
    updated_segments: allUpdatedSegments,
    update_count: allUpdatedSegments.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Handle re_transcribe_segment mode
 * Re-run Whisper transcription on a single segment
 */
async function handleReTranscribeSegmentMode(
  input: UpdateTranscriptInput
): Promise<UpdateTranscriptOutput> {
  if (!input.segment_id) {
    throw missingRequiredFieldError('segment_id', 're_transcribe_segment');
  }

  if (!input.reason) {
    throw missingRequiredFieldError('reason', 're_transcribe_segment');
  }

  const segmentValidation = validateSegmentId(input.segment_id);
  const reasonValidation = validateNonEmptyString(input.reason, 'reason');

  const combined = combineValidationResults(segmentValidation, reasonValidation);
  throwIfInvalid(combined, 're_transcribe_segment inputs');

  logInfo('updateTranscript', `Re-transcribing segment: ${input.segment_id}`, { reason: input.reason });

  // Find the session
  const session = await findSessionForSegment(input.segment_id);

  // Find the segment
  const segment = findAudioSegment(session, input.segment_id);

  // Load audio data
  const audioData = await loadSegmentAudio(segment, 'wav');

  try {
    // Re-transcribe with Whisper
    const result = await openAIService.transcribeAudio(audioData.audioBase64);

    const newTranscription = result; // result is already the transcription text

    logInfo('updateTranscript', `Re-transcription complete`, {
      originalLength: segment.transcription?.length || 0,
      newLength: newTranscription.length
    });

    // Update segment
    const updatedSegment: SessionAudioSegment = {
      ...segment,
      transcription: newTranscription,
      transcriptionQuality: 'final',
      draftTranscription: segment.transcription, // Store old as draft
    };

    // Save session
    const updatedSession = {
      ...session,
      audioSegments: session.audioSegments!.map(s =>
        s.id === input.segment_id ? updatedSegment : s
      )
    };

    await saveSessionUpdates(updatedSession);

    return {
      updated_segments: [updatedSegment],
      update_count: 1
    };

  } catch (error) {
    throw transcriptionServiceError(error, {
      segmentId: input.segment_id,
      reason: input.reason
    });
  }
}

/**
 * Handle re_transcribe_range mode
 * Re-run Whisper on time range with word-level timestamps
 */
async function handleReTranscribeRangeMode(
  input: UpdateTranscriptInput
): Promise<UpdateTranscriptOutput> {
  if (!input.session_id) {
    throw missingRequiredFieldError('session_id', 're_transcribe_range');
  }

  if (input.start_time === undefined || input.end_time === undefined) {
    throw missingRequiredFieldError('start_time and end_time', 're_transcribe_range');
  }

  if (!input.reason) {
    throw missingRequiredFieldError('reason', 're_transcribe_range');
  }

  const sessionValidation = validateSessionId(input.session_id);
  const timeRangeValidation = validateTimeRange(input.start_time, input.end_time);
  const reasonValidation = validateNonEmptyString(input.reason, 'reason');

  const combined = combineValidationResults(sessionValidation, timeRangeValidation, reasonValidation);
  throwIfInvalid(combined, 're_transcribe_range inputs');

  logInfo('updateTranscript', `Re-transcribing range ${input.start_time}s - ${input.end_time}s`, {
    sessionId: input.session_id,
    reason: input.reason
  });

  // Load session
  const session = await loadSession(input.session_id);

  // Get segments in range
  const segments = getAudioSegmentsInRange(session, input.start_time, input.end_time);

  if (segments.length === 0) {
    throw new Error(`No audio segments found in range ${input.start_time}s - ${input.end_time}s`);
  }

  // Load audio for time range
  const audioData = await loadTimeRangeAudio(session, input.start_time, input.end_time, 'wav');

  try {
    // Re-transcribe with word-level timestamps
    const { text, words } = await openAIService.transcribeAudioWithTimestamps(audioData.audioBase64);

    logInfo('updateTranscript', `Re-transcription complete: ${words.length} words`);

    // Map words back to segments
    const sessionStartTime = new Date(session.startTime).getTime();

    const updatedSegments = segments.map(segment => {
      const segmentTime = new Date(segment.timestamp).getTime();
      const relativeStart = (segmentTime - sessionStartTime) / 1000;
      const relativeEnd = relativeStart + segment.duration;

      // Find words in this segment
      const wordsInSegment = words.filter(
        word => word.start >= relativeStart && word.start < relativeEnd
      );

      const newTranscription = wordsInSegment.map(w => w.word).join(' ');

      return {
        ...segment,
        transcription: newTranscription || segment.transcription,
        transcriptionQuality: 'final' as const,
        draftTranscription: segment.transcription,
      };
    });

    // Save session
    const updatedSession = {
      ...session,
      audioSegments: session.audioSegments!.map(s => {
        const updated = updatedSegments.find(us => us.id === s.id);
        return updated || s;
      })
    };

    await saveSessionUpdates(updatedSession);

    logInfo('updateTranscript', `Updated ${updatedSegments.length} segments in range`);

    return {
      updated_segments: updatedSegments,
      update_count: updatedSegments.length
    };

  } catch (error) {
    throw transcriptionServiceError(error, {
      sessionId: input.session_id,
      startTime: input.start_time,
      endTime: input.end_time,
      reason: input.reason
    });
  }
}

/**
 * Handle upgrade_all mode
 * Full session transcript upgrade using transcriptUpgradeService
 */
async function handleUpgradeAllMode(
  input: UpdateTranscriptInput
): Promise<UpdateTranscriptOutput> {
  if (!input.session_id) {
    throw missingRequiredFieldError('session_id', 'upgrade_all');
  }

  const sessionValidation = validateSessionId(input.session_id);
  throwIfInvalid(sessionValidation, 'session_id');

  logInfo('updateTranscript', `Upgrading all transcripts for session: ${input.session_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Check if upgrade needed (unless forced)
  if (!input.force && !transcriptUpgradeService.needsUpgrade(session)) {
    logInfo('updateTranscript', `Session already has upgraded transcripts`);

    return {
      updated_segments: session.audioSegments || [],
      update_count: 0
    };
  }

  // Load full session audio
  const audioData = await loadFullSessionAudio(session, 'wav');

  try {
    // Run transcript upgrade service
    const upgradedSegments = await transcriptUpgradeService.upgradeSegmentTranscripts(
      session,
      audioData.audioBase64
    );

    logInfo('updateTranscript', `Upgrade complete: ${upgradedSegments.length} segments upgraded`);

    // Save session with upgraded transcripts
    const updatedSession = {
      ...session,
      audioSegments: upgradedSegments,
      transcriptUpgradeCompleted: true
    };

    await saveSessionUpdates(updatedSession);

    return {
      updated_segments: upgradedSegments,
      update_count: upgradedSegments.length
    };

  } catch (error) {
    throw transcriptionServiceError(error, {
      sessionId: input.session_id,
      mode: 'upgrade_all'
    });
  }
}

/**
 * Find session containing a segment
 * This is needed when we only have segment_id but not session_id
 */
async function findSessionForSegment(segmentId: string): Promise<Session> {
  // TODO: Optimize this - for now we'll need to search through sessions
  // In the future, could maintain a segment_id -> session_id index

  const chunkedStorage = await getChunkedStorage();
  const metadata = await chunkedStorage.loadAllMetadata();

  for (const sessionMeta of metadata) {
    const session = await loadSession(sessionMeta.id);

    if (session.audioSegments?.some(s => s.id === segmentId)) {
      return session;
    }
  }

  throw new Error(`No session found containing segment: ${segmentId}`);
}

/**
 * Group batch updates by session
 */
async function groupUpdatesBySession(
  updates: Array<{
    segment_id: string;
    corrected_transcription: string;
    correction_reason: string;
    confidence: number;
  }>
): Promise<Record<string, typeof updates>> {
  const grouped: Record<string, typeof updates> = {};

  for (const update of updates) {
    const session = await findSessionForSegment(update.segment_id);

    if (!grouped[session.id]) {
      grouped[session.id] = [];
    }

    grouped[session.id].push(update);
  }

  return grouped;
}

/**
 * Save session updates to storage
 */
async function saveSessionUpdates(session: Session): Promise<void> {
  const chunkedStorage = await getChunkedStorage();

  // Save updated audio segments
  if (session.audioSegments) {
    await chunkedStorage.saveAudioSegments(session.id, session.audioSegments);
  }

  // Update metadata if transcriptUpgradeCompleted flag changed
  if (session.transcriptUpgradeCompleted !== undefined) {
    await chunkedStorage.saveMetadata(session.id, session);
  }

  logInfo('updateTranscript', `Saved session updates: ${session.id}`);
}

/**
 * Export for use in tool executor
 */
export default updateTranscript;
