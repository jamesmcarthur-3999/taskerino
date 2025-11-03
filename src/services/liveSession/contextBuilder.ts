/**
 * Live Session Context Builder
 *
 * Prepares session context for external AI services in various formats:
 * - Summary: Lightweight context for quick AI calls (last 10 screenshots, recent progress)
 * - Full: Comprehensive context for deep analysis (all data)
 * - Delta: What changed since last update (incremental context)
 *
 * Usage:
 * ```typescript
 * const builder = new LiveSessionContextBuilder();
 *
 * // Get lightweight context
 * const context = await builder.buildSummaryContext(sessionId);
 *
 * // Get delta since last update
 * const delta = await builder.buildDeltaContext(sessionId, lastUpdateTimestamp);
 * ```
 */

import type { Session, SessionScreenshot, SessionAudioSegment } from '../../types';
import { getChunkedStorage } from '../storage/ChunkedSessionStorage';
import { LiveSessionContextProvider } from '../LiveSessionContextProvider';

// ============================================================================
// Types
// ============================================================================

/**
 * Summary context (lightweight)
 */
export interface SummaryContext {
  session: {
    id: string;
    name: string;
    status: string;
    startTime: string;
    duration: number;  // minutes
  };
  currentSummary: {
    currentFocus?: string;
    progressToday?: string[];
    momentum?: string;
    achievements?: string[];
    blockers?: string[];
  };
  recentScreenshots: Array<{
    id: string;
    timestamp: string;
    activity: string;
    summary: string;
    achievements?: string[];
    blockers?: string[];
    curiosity?: number;
  }>;
  recentAudio: Array<{
    id: string;
    timestamp: string;
    transcription: string;
    sentiment?: string;
    containsTask?: boolean;
    containsBlocker?: boolean;
  }>;
  progressIndicators: {
    achievements: string[];
    blockers: string[];
    insights: string[];
  };
}

/**
 * Full context (comprehensive)
 */
export interface FullContext {
  session: Session;  // Complete session object
  screenshots: SessionScreenshot[];  // All screenshots
  audioSegments: SessionAudioSegment[];  // All audio
  relatedNotes: any[];  // From UnifiedIndexManager
  relatedTasks: any[];  // From UnifiedIndexManager
  stats: {
    totalScreenshots: number;
    totalAudio: number;
    analyzedScreenshots: number;
    timeRange: { start: string; end: string };
  };
}

/**
 * Delta context (what changed)
 */
export interface DeltaContext {
  session: {
    id: string;
    name: string;
    status: string;
  };
  currentSummary: {
    currentFocus?: string;
    progressToday?: string[];
    momentum?: string;
  };
  newScreenshots: SessionScreenshot[];
  newAudio: SessionAudioSegment[];
  since: string;  // ISO 8601 timestamp
  changeCount: number;
}

// ============================================================================
// LiveSessionContextBuilder
// ============================================================================

export class LiveSessionContextBuilder {
  /**
   * Build summary context (lightweight, ~2-5 KB)
   *
   * Best for: Quick AI calls, real-time updates, frequent polling
   * Includes: Recent 10 screenshots, recent 10 audio, current summary, progress
   *
   * @param sessionId - Session ID
   * @returns Summary context
   */
  async buildSummaryContext(sessionId: string): Promise<SummaryContext> {
    const storage = await getChunkedStorage();
    const session = await storage.loadFullSession(sessionId);

    const provider = new LiveSessionContextProvider(session);

    // Get recent screenshots (last 10)
    const recentScreenshots = provider.getRecentActivity(10)
      .filter(item => item.type === 'screenshot')
      .map(item => {
        const screenshot = item.data as SessionScreenshot;
        return {
          id: screenshot.id,
          timestamp: screenshot.timestamp,
          activity: screenshot.aiAnalysis?.detectedActivity || 'unknown',
          summary: screenshot.aiAnalysis?.summary || '',
          achievements: screenshot.aiAnalysis?.progressIndicators?.achievements || [],
          blockers: screenshot.aiAnalysis?.progressIndicators?.blockers || [],
          curiosity: screenshot.aiAnalysis?.curiosity
        };
      });

    // Get recent audio (last 10)
    const recentAudio = provider.getRecentActivity(10)
      .filter(item => item.type === 'audio')
      .map(item => {
        const audio = item.data as SessionAudioSegment;
        return {
          id: audio.id,
          timestamp: audio.timestamp,
          transcription: audio.transcription,
          sentiment: audio.sentiment,
          containsTask: audio.containsTask,
          containsBlocker: audio.containsBlocker
        };
      });

    // Get progress indicators
    const progressIndicators = provider.getProgressIndicators();

    // Calculate duration
    const startTime = new Date(session.startTime);
    const endTime = session.endTime ? new Date(session.endTime) : new Date();
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60);

    return {
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        startTime: session.startTime,
        duration
      },
      currentSummary: {
        currentFocus: session.summary?.liveSnapshot?.currentFocus,
        progressToday: session.summary?.liveSnapshot?.progressToday,
        momentum: session.summary?.liveSnapshot?.momentum,
        achievements: session.summary?.achievements || [],
        blockers: session.summary?.blockers || []
      },
      recentScreenshots,
      recentAudio,
      progressIndicators
    };
  }

  /**
   * Build full context (comprehensive, ~50-200 KB)
   *
   * Best for: Deep analysis, post-session summarization, comprehensive queries
   * Includes: All screenshots, all audio, related entities, complete session data
   *
   * @param sessionId - Session ID
   * @returns Full context
   */
  async buildFullContext(sessionId: string): Promise<FullContext> {
    const storage = await getChunkedStorage();
    const session = await storage.loadFullSession(sessionId);

    const provider = new LiveSessionContextProvider(session);

    // Get related entities (notes, tasks) using UnifiedIndexManager
    const { getUnifiedIndexManager } = await import('../storage/UnifiedIndexManager');
    const indexManager = await getUnifiedIndexManager();

    const relatedNotesResult = await indexManager.search({
      entityTypes: ['notes'],
      relatedTo: {
        entityType: 'session',
        entityId: sessionId
      },
      limit: 100
    });

    const relatedTasksResult = await indexManager.search({
      entityTypes: ['tasks'],
      relatedTo: {
        entityType: 'session',
        entityId: sessionId
      },
      limit: 100
    });

    // Get stats
    const stats = provider.getStats();

    return {
      session,
      screenshots: session.screenshots || [],
      audioSegments: session.audioSegments || [],
      relatedNotes: relatedNotesResult.results.notes || [],
      relatedTasks: relatedTasksResult.results.tasks || [],
      stats
    };
  }

  /**
   * Build delta context (what changed, ~1-10 KB)
   *
   * Best for: Incremental updates, event-driven AI, minimizing redundant data
   * Includes: Only new screenshots/audio since timestamp, current summary
   *
   * @param sessionId - Session ID
   * @param since - ISO 8601 timestamp (only include changes after this time)
   * @returns Delta context
   */
  async buildDeltaContext(sessionId: string, since: string): Promise<DeltaContext> {
    const storage = await getChunkedStorage();
    const session = await storage.loadFullSession(sessionId);

    const provider = new LiveSessionContextProvider(session);

    // Get activity since timestamp
    const activity = provider.getActivitySince(since);

    // Separate screenshots and audio
    const newScreenshots = activity
      .filter(item => item.type === 'screenshot')
      .map(item => item.data as SessionScreenshot);

    const newAudio = activity
      .filter(item => item.type === 'audio')
      .map(item => item.data as SessionAudioSegment);

    return {
      session: {
        id: session.id,
        name: session.name,
        status: session.status
      },
      currentSummary: {
        currentFocus: session.summary?.liveSnapshot?.currentFocus,
        progressToday: session.summary?.liveSnapshot?.progressToday,
        momentum: session.summary?.liveSnapshot?.momentum
      },
      newScreenshots,
      newAudio,
      since,
      changeCount: newScreenshots.length + newAudio.length
    };
  }

  /**
   * Estimate context size (approximate bytes)
   *
   * Useful for choosing context type based on budget.
   *
   * @param contextType - Type of context to estimate
   * @param sessionId - Session ID
   * @returns Estimated size in bytes
   */
  async estimateContextSize(
    contextType: 'summary' | 'full' | 'delta',
    sessionId: string,
    since?: string
  ): Promise<number> {
    let context: any;

    if (contextType === 'summary') {
      context = await this.buildSummaryContext(sessionId);
    } else if (contextType === 'full') {
      context = await this.buildFullContext(sessionId);
    } else if (contextType === 'delta' && since) {
      context = await this.buildDeltaContext(sessionId, since);
    } else {
      throw new Error('Invalid context type or missing parameters');
    }

    // Rough estimate (JSON.stringify length)
    const jsonString = JSON.stringify(context);
    return jsonString.length;
  }

  /**
   * Get recommended context type
   *
   * Chooses context type based on session age and change rate.
   *
   * @param sessionId - Session ID
   * @param lastUpdateTime - When AI last updated (optional)
   * @returns Recommended context type
   */
  async getRecommendedContextType(
    sessionId: string,
    lastUpdateTime?: string
  ): Promise<'summary' | 'full' | 'delta'> {
    const storage = await getChunkedStorage();
    const metadata = await storage.loadMetadata(sessionId);

    if (!metadata) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // If no previous update, use summary context
    if (!lastUpdateTime) {
      return 'summary';
    }

    // If session is completed, use full context for final summary
    if (metadata.status === 'completed') {
      return 'full';
    }

    // If recent update (<5 minutes ago), use delta
    const timeSinceUpdate = Date.now() - new Date(lastUpdateTime).getTime();
    const minutesSinceUpdate = timeSinceUpdate / 1000 / 60;

    if (minutesSinceUpdate < 5) {
      return 'delta';
    }

    // Default: summary context
    return 'summary';
  }
}
