/**
 * updateAnalysis Tool
 *
 * Updates AI-generated analysis across multiple entity types:
 * - screenshot: Update screenshot AI analysis
 * - audio_segment: Update audio segment metadata (keyPhrases, sentiment, etc.)
 * - session_summary: Update or regenerate session summary
 * - audio_insights: Update comprehensive audio insights
 *
 * This tool allows AI agents to refine and enrich analysis results.
 */

import type {
  UpdateAnalysisInput,
  UpdateAnalysisOutput,
  ToolExecutionResult
} from '../types';
import type {
  Session,
  SessionScreenshot,
  SessionAudioSegment,
  SessionSummary,
  AudioInsights
} from '../../../types';
import {
  loadSession,
  findScreenshot,
  findAudioSegment
} from '../utils/sessionLoader';
import {
  validateSessionId,
  validateNonEmptyString,
  throwIfInvalid
} from '../utils/validation';
import {
  missingRequiredFieldError,
  invalidModeError,
  withErrorHandling,
  createToolError,
  logInfo,
  logWarning
} from '../utils/errorHandling';
import { getChunkedStorage } from '../../storage/ChunkedSessionStorage';

/**
 * Main tool execution function
 */
export async function updateAnalysis(
  input: UpdateAnalysisInput
): Promise<ToolExecutionResult<UpdateAnalysisOutput>> {
  const startTime = Date.now();

  const result = await withErrorHandling(
    async () => executeUpdateAnalysis(input),
    {
      userMessage: 'Failed to update analysis',
      toolName: 'updateAnalysis',
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
async function executeUpdateAnalysis(
  input: UpdateAnalysisInput
): Promise<UpdateAnalysisOutput> {
  // Validate session ID
  const sessionValidation = validateSessionId(input.session_id);
  throwIfInvalid(sessionValidation, 'session_id');

  // Route to appropriate handler based on mode
  switch (input.mode) {
    case 'screenshot':
      return await handleScreenshotMode(input);

    case 'audio_segment':
      return await handleAudioSegmentMode(input);

    case 'session_summary':
      return await handleSessionSummaryMode(input);

    case 'audio_insights':
      return await handleAudioInsightsMode(input);

    default:
      throw invalidModeError(
        input.mode,
        ['screenshot', 'audio_segment', 'session_summary', 'audio_insights']
      );
  }
}

/**
 * Handle screenshot mode
 * Updates AI analysis for a specific screenshot
 */
async function handleScreenshotMode(
  input: UpdateAnalysisInput
): Promise<UpdateAnalysisOutput> {
  if (!input.screenshot_id) {
    throw missingRequiredFieldError('screenshot_id', 'screenshot');
  }

  if (!input.analysis) {
    throw missingRequiredFieldError('analysis', 'screenshot');
  }

  logInfo('updateAnalysis', `Updating screenshot analysis: ${input.screenshot_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Find screenshot
  const screenshot = findScreenshot(session, input.screenshot_id);

  // Create updated screenshot with new analysis
  const updatedScreenshot: SessionScreenshot = {
    ...screenshot,
    aiAnalysis: {
      ...screenshot.aiAnalysis,
      ...input.analysis,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'ai'
    }
  };

  // Update in session
  const screenshotIndex = session.screenshots.findIndex(s => s.id === input.screenshot_id);
  session.screenshots[screenshotIndex] = updatedScreenshot;

  // Save updates
  await saveSessionUpdates(session);

  logInfo('updateAnalysis', `Screenshot analysis updated: ${input.screenshot_id}`);

  return {
    updated_screenshot: updatedScreenshot
  };
}

/**
 * Handle audio_segment mode
 * Updates metadata for a specific audio segment
 */
async function handleAudioSegmentMode(
  input: UpdateAnalysisInput
): Promise<UpdateAnalysisOutput> {
  if (!input.segment_id) {
    throw missingRequiredFieldError('segment_id', 'audio_segment');
  }

  if (!input.segment_metadata) {
    throw missingRequiredFieldError('segment_metadata', 'audio_segment');
  }

  logInfo('updateAnalysis', `Updating audio segment metadata: ${input.segment_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Find segment
  const segment = findAudioSegment(session, input.segment_id);

  // Create updated segment with new metadata
  const updatedSegment: SessionAudioSegment = {
    ...segment,
    ...input.segment_metadata,
  };

  // Update in session
  if (!session.audioSegments) {
    throw createToolError(
      'Session has no audio segments',
      new Error('No audioSegments array'),
      { sessionId: session.id }
    );
  }

  const segmentIndex = session.audioSegments.findIndex(s => s.id === input.segment_id);
  session.audioSegments[segmentIndex] = updatedSegment;

  // Save updates
  await saveSessionUpdates(session);

  logInfo('updateAnalysis', `Audio segment metadata updated: ${input.segment_id}`);

  return {
    updated_segment: updatedSegment
  };
}

/**
 * Handle session_summary mode
 * Updates or regenerates session summary
 */
async function handleSessionSummaryMode(
  input: UpdateAnalysisInput
): Promise<UpdateAnalysisOutput> {
  if (!input.summary) {
    throw missingRequiredFieldError('summary', 'session_summary');
  }

  logInfo('updateAnalysis', `Updating session summary: ${input.session_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Create updated summary
  const updatedSummary: SessionSummary = {
    ...session.summary,
    ...input.summary,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'ai'
  };

  // Update in session
  session.summary = updatedSummary;

  // Save updates
  await saveSessionUpdates(session);

  logInfo('updateAnalysis', `Session summary updated: ${input.session_id}`);

  return {
    updated_summary: updatedSummary
  };
}

/**
 * Handle audio_insights mode
 * Updates comprehensive audio insights
 */
async function handleAudioInsightsMode(
  input: UpdateAnalysisInput
): Promise<UpdateAnalysisOutput> {
  if (!input.audio_insights) {
    throw missingRequiredFieldError('audio_insights', 'audio_insights');
  }

  logInfo('updateAnalysis', `Updating audio insights: ${input.session_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Create updated audio insights
  const updatedInsights: AudioInsights = {
    ...session.audioInsights,
    ...input.audio_insights,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'ai'
  };

  // Update in session
  session.audioInsights = updatedInsights;

  // Save updates
  await saveSessionUpdates(session);

  logInfo('updateAnalysis', `Audio insights updated: ${input.session_id}`);

  return {
    updated_audio_insights: updatedInsights
  };
}

/**
 * Save session updates via ChunkedStorage
 */
async function saveSessionUpdates(session: Session): Promise<void> {
  const chunkedStorage = await getChunkedStorage();

  try {
    // Save updated chunks
    // ChunkedStorage will handle batching via PersistenceQueue

    if (session.summary) {
      await chunkedStorage.saveSummary(session.id, session.summary);
    }

    if (session.audioInsights) {
      await chunkedStorage.saveAudioInsights(session.id, session.audioInsights);
    }

    if (session.screenshots && session.screenshots.length > 0) {
      // Save all screenshots (ChunkedStorage will chunk them)
      await chunkedStorage.saveScreenshots(session.id, session.screenshots);
    }

    if (session.audioSegments && session.audioSegments.length > 0) {
      // Save all audio segments (ChunkedStorage will chunk them)
      await chunkedStorage.saveAudioSegments(session.id, session.audioSegments);
    }

    // Save metadata last (includes timestamps)
    // Use sessionToMetadata helper to convert full session to metadata
    await chunkedStorage.saveFullSession(session);

  } catch (error) {
    throw createToolError(
      'Failed to save session updates',
      error,
      { sessionId: session.id }
    );
  }
}

/**
 * Export for use in tool executor
 */
export default updateAnalysis;
