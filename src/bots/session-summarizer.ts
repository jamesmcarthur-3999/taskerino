// src/bots/session-summarizer.ts
import { Baleybot, text } from '@baleybots/core';
import { MODELS } from './config';
import { SessionSummarySchema, type SessionSummary } from './types';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../types';

/**
 * Session Summarizer Bot
 *
 * Generates comprehensive summaries of completed work sessions
 * by analyzing screenshots, audio transcriptions, and metadata.
 */
export const sessionSummarizer = Baleybot.create({
  name: 'session-summarizer',
  goal: `You are a session analysis agent that creates comprehensive summaries of work sessions. Given session data including:
- Session metadata (name, description, duration)
- Screenshot analyses (what was visible/happening)
- Audio transcriptions (what was said)

Generate a detailed summary that:
1. Tells the story of the session (narrative)
2. Lists achievements and blockers
3. Recommends follow-up tasks with priorities
4. Extracts key insights with timestamps
5. Identifies focus areas with time allocation
6. Categorizes the work type
7. Generates searchable tags

Be thorough but organized. Focus on actionable insights.`,
  model: MODELS.STANDARD,
  outputSchema: SessionSummarySchema,
  verbose: false,
});

/**
 * Format session data for the summarizer
 */
function formatSessionContext(
  session: Session,
  screenshots: SessionScreenshot[],
  audioSegments?: SessionAudioSegment[]
): string {
  const parts: string[] = [];

  // Session metadata
  parts.push(`## Session: ${session.name}`);
  if (session.description) {
    parts.push(`Description: ${session.description}`);
  }
  parts.push(`Duration: ${session.startTime} to ${session.endTime || 'ongoing'}`);
  parts.push(`Status: ${session.status}`);
  parts.push('');

  // Screenshots with analyses
  if (screenshots.length > 0) {
    parts.push('## Screenshots Analysis');
    screenshots.forEach((ss, i) => {
      parts.push(`### Screenshot ${i + 1} (${ss.timestamp})`);
      if (ss.aiAnalysis) {
        parts.push(`Activity: ${ss.aiAnalysis.detectedActivity}`);
        parts.push(`Summary: ${ss.aiAnalysis.summary}`);
        if (ss.aiAnalysis.extractedText) {
          parts.push(`Text: ${ss.aiAnalysis.extractedText}`);
        }
        if (ss.aiAnalysis.progressIndicators) {
          const pi = ss.aiAnalysis.progressIndicators;
          if (pi.achievements?.length) parts.push(`Achievements: ${pi.achievements.join(', ')}`);
          if (pi.blockers?.length) parts.push(`Blockers: ${pi.blockers.join(', ')}`);
          if (pi.insights?.length) parts.push(`Insights: ${pi.insights.join(', ')}`);
        }
      }
      parts.push('');
    });
  }

  // Audio transcriptions
  if (audioSegments && audioSegments.length > 0) {
    parts.push('## Audio Transcriptions');
    audioSegments.forEach((seg, i) => {
      parts.push(`### Segment ${i + 1} (${seg.timestamp}, ${seg.duration}s)`);
      parts.push(seg.transcription);
      if (seg.keyPhrases?.length) {
        parts.push(`Key phrases: ${seg.keyPhrases.join(', ')}`);
      }
      parts.push('');
    });
  }

  return parts.join('\n');
}

/**
 * Generate a comprehensive session summary
 */
export async function summarizeSession(
  session: Session,
  screenshots: SessionScreenshot[],
  audioSegments?: SessionAudioSegment[]
): Promise<SessionSummary> {
  const context = formatSessionContext(session, screenshots, audioSegments);

  return sessionSummarizer.process(text(context));
}
