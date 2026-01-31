// src/bots/adapters/sessions-agent-adapter.ts
/**
 * Adapter that provides the same interface as sessionsAgentService
 * but uses Baleybots under the hood.
 *
 * This allows gradual migration without breaking existing code.
 */

import {
  analyzeScreenshot as botAnalyzeScreenshot,
  clearScreenshotContext,
} from '../screenshot-analyzer';
import { summarizeSession as botSummarizeSession } from '../session-summarizer';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../types';

class SessionsAgentServiceAdapter {
  private hasApiKey = false;

  async setApiKey(apiKey: string): Promise<void> {
    // API key is managed by bots/config.ts now
    // This is kept for interface compatibility
    const { updateApiKeys } = await import('../config');
    await updateApiKeys({ claudeApiKey: apiKey });
    this.hasApiKey = true;
  }

  async analyzeScreenshot(
    screenshot: SessionScreenshot,
    session: Session,
    screenshotBase64: string,
    mimeType?: string
  ): Promise<SessionScreenshot['aiAnalysis']> {
    return botAnalyzeScreenshot(
      screenshotBase64,
      session.id,
      session.name,
      (mimeType as 'image/png' | 'image/jpeg') || 'image/png'
    );
  }

  async generateSessionSummary(
    session: Session,
    screenshots: SessionScreenshot[],
    audioSegments?: SessionAudioSegment[]
  ) {
    const summary = await botSummarizeSession(session, screenshots, audioSegments);

    // Map to expected format
    return {
      ...summary,
      lastUpdated: new Date().toISOString(),
      screenshotCount: screenshots.length,
    };
  }

  clearSessionContext(sessionId: string): void {
    clearScreenshotContext(sessionId);
  }

  getContextWindowSize(): number {
    return 5; // Matches the MAX_CONTEXT_WINDOW in screenshot-analyzer
  }

  async reloadApiKey(): Promise<void> {
    const { initializeBots } = await import('../config');
    await initializeBots();
    this.hasApiKey = true;
  }
}

// Export singleton for drop-in replacement
export const sessionsAgentService = new SessionsAgentServiceAdapter();
