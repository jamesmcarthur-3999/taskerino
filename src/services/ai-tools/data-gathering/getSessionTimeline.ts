/**
 * getSessionTimeline Tool
 *
 * Builds a chronological timeline of session events:
 * - Screenshots with AI analysis
 * - Audio segments with transcriptions
 * - Achievements detected by AI
 * - Blockers detected by AI
 *
 * Useful for understanding session flow and context.
 */

import type {
  GetSessionTimelineInput,
  GetSessionTimelineOutput,
  TimelineItem,
  ToolExecutionResult
} from '../types';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../../types';
import {
  loadSession,
  getRelativeTimestamp,
  getSessionDuration
} from '../utils/sessionLoader';
import {
  validateSessionId,
  validateTimeRange,
  throwIfInvalid
} from '../utils/validation';
import {
  withErrorHandling,
  logInfo
} from '../utils/errorHandling';

/**
 * Main tool execution function
 */
export async function getSessionTimeline(
  input: GetSessionTimelineInput
): Promise<ToolExecutionResult<GetSessionTimelineOutput>> {
  const startTime = Date.now();

  const result = await withErrorHandling(
    async () => executeGetSessionTimeline(input),
    {
      userMessage: 'Failed to retrieve session timeline',
      toolName: 'getSessionTimeline',
      context: { session_id: input.session_id }
    }
  );

  const executionTime = Date.now() - startTime;

  return {
    success: true,
    data: result,
    metadata: {
      executionTime
    }
  };
}

/**
 * Core execution logic
 */
async function executeGetSessionTimeline(
  input: GetSessionTimelineInput
): Promise<GetSessionTimelineOutput> {
  // Validate session ID
  const sessionValidation = validateSessionId(input.session_id);
  throwIfInvalid(sessionValidation, 'session_id');

  // Validate time range if provided
  if (input.start_time !== undefined && input.end_time !== undefined) {
    const timeRangeValidation = validateTimeRange(input.start_time, input.end_time);
    throwIfInvalid(timeRangeValidation, 'time range');
  }

  logInfo('getSessionTimeline', `Building timeline for session: ${input.session_id}`);

  // Load session
  const session = await loadSession(input.session_id);

  // Build timeline
  const timeline = buildTimeline(session, input);

  // Calculate duration
  const sessionDuration = getSessionDuration(session);

  logInfo('getSessionTimeline', `Built timeline with ${timeline.length} items`);

  return {
    timeline,
    session_duration: sessionDuration,
    item_count: timeline.length
  };
}

/**
 * Build timeline from session data
 */
function buildTimeline(
  session: Session,
  input: GetSessionTimelineInput
): TimelineItem[] {
  const timeline: TimelineItem[] = [];

  // Add screenshots if requested
  if (input.include_screenshots !== false) {
    for (const screenshot of session.screenshots) {
      const relativeTime = getRelativeTimestamp(session, screenshot.timestamp);

      // Apply time range filter
      if (isWithinTimeRange(relativeTime, input.start_time, input.end_time)) {
        timeline.push({
          type: 'screenshot',
          timestamp: screenshot.timestamp,
          relative_time: relativeTime,
          data: screenshot
        });
      }
    }
  }

  // Add audio segments if requested
  if (input.include_audio !== false && session.audioSegments) {
    for (const segment of session.audioSegments) {
      const relativeTime = getRelativeTimestamp(session, segment.timestamp);

      // Apply time range filter
      if (isWithinTimeRange(relativeTime, input.start_time, input.end_time)) {
        timeline.push({
          type: 'audio',
          timestamp: segment.timestamp,
          relative_time: relativeTime,
          data: segment
        });
      }
    }
  }

  // Add achievements if requested
  if (input.include_achievements) {
    extractAchievements(session, input, timeline);
  }

  // Add blockers if requested
  if (input.include_blockers) {
    extractBlockers(session, input, timeline);
  }

  // Sort timeline by relative time
  timeline.sort((a, b) => a.relative_time - b.relative_time);

  return timeline;
}

/**
 * Extract achievements from session data
 */
function extractAchievements(
  session: Session,
  input: GetSessionTimelineInput,
  timeline: TimelineItem[]
): void {
  // From screenshots
  if (session.screenshots && input.include_screenshots !== false) {
    for (const screenshot of session.screenshots) {
      if (screenshot.aiAnalysis?.progressIndicators?.achievements) {
        for (const achievement of screenshot.aiAnalysis.progressIndicators.achievements) {
          const relativeTime = getRelativeTimestamp(session, screenshot.timestamp);

          if (isWithinTimeRange(relativeTime, input.start_time, input.end_time)) {
            timeline.push({
              type: 'achievement',
              timestamp: screenshot.timestamp,
              relative_time: relativeTime,
              data: { description: achievement }
            });
          }
        }
      }
    }
  }

  // From audio insights
  if (session.audioInsights?.keyMoments) {
    for (const moment of session.audioInsights.keyMoments) {
      if (moment.type === 'achievement') {
        if (isWithinTimeRange(moment.timestamp, input.start_time, input.end_time)) {
          const absoluteTimestamp = new Date(
            new Date(session.startTime).getTime() + moment.timestamp * 1000
          ).toISOString();

          timeline.push({
            type: 'achievement',
            timestamp: absoluteTimestamp,
            relative_time: moment.timestamp,
            data: { description: moment.label }
          });
        }
      }
    }
  }

  // From session summary
  if (session.summary?.achievements) {
    // Summary achievements don't have specific timestamps
    // We can add them at the end of the session
    const sessionDuration = getSessionDuration(session);

    if (isWithinTimeRange(sessionDuration, input.start_time, input.end_time)) {
      for (const achievement of session.summary.achievements) {
        const absoluteTimestamp = new Date(
          new Date(session.startTime).getTime() + sessionDuration * 1000
        ).toISOString();

        timeline.push({
          type: 'achievement',
          timestamp: absoluteTimestamp,
          relative_time: sessionDuration,
          data: { description: achievement }
        });
      }
    }
  }
}

/**
 * Extract blockers from session data
 */
function extractBlockers(
  session: Session,
  input: GetSessionTimelineInput,
  timeline: TimelineItem[]
): void {
  // From screenshots
  if (session.screenshots && input.include_screenshots !== false) {
    for (const screenshot of session.screenshots) {
      if (screenshot.aiAnalysis?.progressIndicators?.blockers) {
        for (const blocker of screenshot.aiAnalysis.progressIndicators.blockers) {
          const relativeTime = getRelativeTimestamp(session, screenshot.timestamp);

          if (isWithinTimeRange(relativeTime, input.start_time, input.end_time)) {
            timeline.push({
              type: 'blocker',
              timestamp: screenshot.timestamp,
              relative_time: relativeTime,
              data: { description: blocker }
            });
          }
        }
      }
    }
  }

  // From audio insights
  if (session.audioInsights?.keyMoments) {
    for (const moment of session.audioInsights.keyMoments) {
      if (moment.type === 'blocker') {
        if (isWithinTimeRange(moment.timestamp, input.start_time, input.end_time)) {
          const absoluteTimestamp = new Date(
            new Date(session.startTime).getTime() + moment.timestamp * 1000
          ).toISOString();

          timeline.push({
            type: 'blocker',
            timestamp: absoluteTimestamp,
            relative_time: moment.timestamp,
            data: { description: moment.label }
          });
        }
      }
    }
  }

  // From session summary
  if (session.summary?.blockers) {
    const sessionDuration = getSessionDuration(session);

    if (isWithinTimeRange(sessionDuration, input.start_time, input.end_time)) {
      for (const blocker of session.summary.blockers) {
        const absoluteTimestamp = new Date(
          new Date(session.startTime).getTime() + sessionDuration * 1000
        ).toISOString();

        timeline.push({
          type: 'blocker',
          timestamp: absoluteTimestamp,
          relative_time: sessionDuration,
          data: { description: blocker }
        });
      }
    }
  }

  // From audio segments
  if (session.audioSegments && input.include_audio !== false) {
    for (const segment of session.audioSegments) {
      if (segment.containsBlocker) {
        const relativeTime = getRelativeTimestamp(session, segment.timestamp);

        if (isWithinTimeRange(relativeTime, input.start_time, input.end_time)) {
          timeline.push({
            type: 'blocker',
            timestamp: segment.timestamp,
            relative_time: relativeTime,
            data: { description: segment.transcription || 'Blocker detected in audio' }
          });
        }
      }
    }
  }
}

/**
 * Check if time is within range
 */
function isWithinTimeRange(
  time: number,
  startTime?: number,
  endTime?: number
): boolean {
  if (startTime !== undefined && time < startTime) return false;
  if (endTime !== undefined && time > endTime) return false;
  return true;
}

/**
 * Export for use in tool executor
 */
export default getSessionTimeline;
