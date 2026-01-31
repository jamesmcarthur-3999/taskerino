// src/bots/screenshot-analyzer.ts
import { Baleybot, image, combine, text } from '@baleybots/core';
import { MODELS } from './config';
import { ScreenshotAnalysisSchema, type ScreenshotAnalysis } from './types';

// Context window for maintaining screenshot history
const contextWindows = new Map<string, string[]>();
const MAX_CONTEXT_WINDOW = 5;

/**
 * Get context summary for a session
 */
function getContextSummary(sessionId: string): string {
  const context = contextWindows.get(sessionId) || [];
  if (context.length === 0) return 'This is the first screenshot in the session.';
  return `Previous ${context.length} screenshot summaries:\n${context.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

/**
 * Update context window with new summary
 */
function updateContext(sessionId: string, summary: string): void {
  const context = contextWindows.get(sessionId) || [];
  context.push(summary);
  if (context.length > MAX_CONTEXT_WINDOW) {
    context.shift();
  }
  contextWindows.set(sessionId, context);
}

/**
 * Clear context for a session (call when session ends)
 */
export function clearScreenshotContext(sessionId: string): void {
  contextWindows.delete(sessionId);
}

/**
 * Screenshot Analyzer Bot
 *
 * Analyzes screenshots during active sessions to detect activity,
 * extract text, and track progress.
 */
export const screenshotAnalyzer = Baleybot.create({
  name: 'screenshot-analyzer',
  goal: `You are a screenshot analysis agent for a productivity app. Analyze screenshots from work sessions to:

1. Detect the current activity (coding, meetings, research, etc.)
2. Extract important visible text (URLs, errors, data)
3. Identify key UI elements and actions being performed
4. Track progress: achievements, blockers, and insights
5. Determine how "curious" you are to see the next screenshot (0-1)

Be concise but thorough. Focus on actionable insights.`,
  model: MODELS.FAST,
  outputSchema: ScreenshotAnalysisSchema,
  verbose: false,
});

/**
 * Analyze a screenshot with session context
 */
export async function analyzeScreenshot(
  screenshotBase64: string,
  sessionId: string,
  sessionName: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<ScreenshotAnalysis> {
  const contextSummary = getContextSummary(sessionId);

  const input = combine(
    text(`Session: "${sessionName}"\n\nContext:\n${contextSummary}\n\nAnalyze this screenshot:`),
    image({ data: screenshotBase64, mediaType: mimeType })
  );

  const result = await screenshotAnalyzer.process(input);

  // Update context window with this analysis
  updateContext(sessionId, result.summary);

  return result;
}
