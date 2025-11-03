/**
 * LiveSessionContextProvider - In-Memory Session Context Query Service
 *
 * The LiveSessionContextProvider provides fast, in-memory querying of session data
 * with support for focus filtering, text search, and timeline aggregation.
 *
 * ARCHITECTURE:
 * - In-memory filtering for <1ms performance on typical sessions (10-100 items)
 * - Support for screenshots, audio segments, and timeline queries
 * - Optional focus filter for narrowing AI's attention during active sessions
 * - Efficient single-pass filtering where possible
 *
 * USAGE:
 * ```typescript
 * const provider = new LiveSessionContextProvider(session, focusFilter);
 *
 * // Search screenshots
 * const screenshots = provider.searchScreenshots({
 *   activity: 'coding',
 *   text: 'authentication',
 *   hasAchievements: true,
 *   limit: 10
 * });
 *
 * // Search audio
 * const audio = provider.searchAudioSegments({
 *   text: 'bug',
 *   sentiment: 'negative',
 *   limit: 5
 * });
 *
 * // Get recent activity
 * const recent = provider.getRecentActivity(20);
 *
 * // Get activity since timestamp
 * const since = provider.getActivitySince('2025-11-02T10:00:00Z');
 * ```
 *
 * @module LiveSessionContextProvider
 */

import type {
  Session,
  SessionScreenshot,
  SessionAudioSegment,
} from '../types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Query interface for searching screenshots.
 *
 * Supports:
 * - Activity filtering (detected activity type)
 * - Text search (extractedText and summary)
 * - Key elements search (keyElements array)
 * - Achievement/blocker filtering
 * - Curiosity score filtering
 * - Time range filtering
 * - Result limiting
 *
 * @example
 * ```typescript
 * const query: ScreenshotQuery = {
 *   activity: 'coding',
 *   text: 'authentication',
 *   hasAchievements: true,
 *   minCuriosity: 0.7,
 *   since: '2025-11-02T10:00:00Z',
 *   limit: 10
 * };
 * ```
 */
export interface ScreenshotQuery {
  /**
   * Filter by detected activity (case-insensitive substring match)
   */
  activity?: string;

  /**
   * Search in extractedText and summary (case-insensitive)
   */
  text?: string;

  /**
   * Search in keyElements array (match any element, case-insensitive)
   */
  elements?: string[];

  /**
   * Filter screenshots with achievements
   */
  hasAchievements?: boolean;

  /**
   * Filter screenshots with blockers
   */
  hasBlockers?: boolean;

  /**
   * Minimum curiosity score (0-1)
   */
  minCuriosity?: number;

  /**
   * Filter screenshots since this timestamp (ISO string)
   */
  since?: string;

  /**
   * Filter screenshots until this timestamp (ISO string)
   */
  until?: string;

  /**
   * Maximum number of results to return
   */
  limit?: number;
}

/**
 * Query interface for searching audio segments.
 *
 * Supports:
 * - Text search (transcription)
 * - Key phrases search
 * - Sentiment filtering
 * - Task/blocker detection
 * - Time range filtering
 * - Result limiting
 *
 * @example
 * ```typescript
 * const query: AudioQuery = {
 *   text: 'bug',
 *   sentiment: 'negative',
 *   containsBlocker: true,
 *   limit: 5
 * };
 * ```
 */
export interface AudioQuery {
  /**
   * Search in transcription (case-insensitive)
   */
  text?: string;

  /**
   * Search in keyPhrases array (match any phrase, case-insensitive)
   */
  phrases?: string[];

  /**
   * Filter by sentiment
   */
  sentiment?: 'positive' | 'neutral' | 'negative';

  /**
   * Filter segments containing tasks
   */
  containsTask?: boolean;

  /**
   * Filter segments containing blockers
   */
  containsBlocker?: boolean;

  /**
   * Filter segments since this timestamp (ISO string)
   */
  since?: string;

  /**
   * Filter segments until this timestamp (ISO string)
   */
  until?: string;

  /**
   * Maximum number of results to return
   */
  limit?: number;
}

/**
 * Timeline item representing a screenshot or audio segment.
 *
 * Used for chronological activity timelines.
 *
 * @example
 * ```typescript
 * const item: TimelineItem = {
 *   type: 'screenshot',
 *   timestamp: '2025-11-02T10:00:00Z',
 *   data: screenshot
 * };
 * ```
 */
export interface TimelineItem {
  /**
   * Type of timeline item
   */
  type: 'screenshot' | 'audio';

  /**
   * ISO timestamp of the item
   */
  timestamp: string;

  /**
   * The screenshot or audio segment data
   */
  data: SessionScreenshot | SessionAudioSegment;
}

/**
 * Progress summary aggregating achievements, blockers, and insights.
 *
 * Used to summarize session progress indicators.
 *
 * @example
 * ```typescript
 * const summary: ProgressSummary = {
 *   achievements: ['Completed login flow', 'Fixed auth bug'],
 *   blockers: ['Waiting on API key'],
 *   insights: ['User prefers email login']
 * };
 * ```
 */
export interface ProgressSummary {
  /**
   * List of achievements (deduplicated)
   */
  achievements: string[];

  /**
   * List of blockers (deduplicated)
   */
  blockers: string[];

  /**
   * List of insights (deduplicated)
   */
  insights: string[];
}

/**
 * Focus filter for narrowing session context.
 *
 * Used during active sessions to focus AI attention on specific activities,
 * keywords, or time ranges.
 *
 * @example
 * ```typescript
 * const filter: SessionFocusFilter = {
 *   activities: ['coding', 'debugging'],
 *   keywords: ['authentication', 'bug'],
 *   minCuriosity: 0.7,
 *   hasAchievements: true,
 *   since: '2025-11-02T10:00:00Z'
 * };
 * ```
 */
export interface SessionFocusFilter {
  /**
   * Include only these activities (case-insensitive)
   */
  activities?: string[];

  /**
   * Exclude these activities (case-insensitive)
   */
  excludeActivities?: string[];

  /**
   * Include only items containing these keywords (case-insensitive)
   */
  keywords?: string[];

  /**
   * Minimum curiosity score (0-1)
   */
  minCuriosity?: number;

  /**
   * Include only items with achievements
   */
  hasAchievements?: boolean;

  /**
   * Include only items with blockers
   */
  hasBlockers?: boolean;

  /**
   * Include only items since this timestamp
   */
  since?: string;

  /**
   * Include only items until this timestamp
   */
  until?: string;
}

// =============================================================================
// LIVE SESSION CONTEXT PROVIDER
// =============================================================================

/**
 * LiveSessionContextProvider - Fast in-memory session data queries.
 *
 * The LiveSessionContextProvider provides efficient querying of session data
 * with optional focus filtering. All operations are performed in-memory for
 * <1ms performance on typical sessions (10-100 items).
 *
 * DESIGN PRINCIPLES:
 * - Single-pass filtering where possible
 * - Efficient string matching (toLowerCase, includes)
 * - Focus filter application for narrowing results
 * - Consistent result ordering (newest first for searches, chronological for timelines)
 *
 * PERFORMANCE:
 * - Target: <1ms for typical sessions (10-100 items)
 * - Approach: In-memory filtering with efficient algorithms
 * - No database queries or async operations (synchronous)
 *
 * @example
 * ```typescript
 * const provider = new LiveSessionContextProvider(session, focusFilter);
 *
 * // Search screenshots
 * const screenshots = provider.searchScreenshots({
 *   activity: 'coding',
 *   hasBlockers: true
 * });
 *
 * // Get recent activity
 * const recent = provider.getRecentActivity(20);
 * ```
 */
export class LiveSessionContextProvider {
  private session: Session;
  private focusFilter?: SessionFocusFilter;

  /**
   * Create a new LiveSessionContextProvider.
   *
   * @param session - Session to query
   * @param focusFilter - Optional focus filter to narrow results
   *
   * @example
   * ```typescript
   * const provider = new LiveSessionContextProvider(session);
   *
   * // With focus filter
   * const focusedProvider = new LiveSessionContextProvider(session, {
   *   activities: ['coding'],
   *   minCuriosity: 0.7
   * });
   * ```
   */
  constructor(session: Session, focusFilter?: SessionFocusFilter) {
    this.session = session;
    this.focusFilter = focusFilter;
  }

  /**
   * Search screenshots with filtering and optional focus filter.
   *
   * Applies all query filters in a single pass for efficiency:
   * 1. Activity filtering (case-insensitive substring match)
   * 2. Text search (extractedText and summary)
   * 3. Key elements search
   * 4. Achievement/blocker filtering
   * 5. Curiosity score filtering
   * 6. Time range filtering
   * 7. Focus filter application
   * 8. Sort by timestamp (newest first)
   * 9. Limit results
   *
   * Performance: <1ms for typical sessions (10-100 screenshots)
   *
   * @param query - Screenshot query with filters
   * @returns Filtered screenshots sorted by timestamp (newest first)
   *
   * @example
   * ```typescript
   * const screenshots = provider.searchScreenshots({
   *   activity: 'coding',
   *   text: 'authentication',
   *   hasAchievements: true,
   *   minCuriosity: 0.7,
   *   limit: 10
   * });
   * ```
   */
  searchScreenshots(query: ScreenshotQuery): SessionScreenshot[] {
    let results = this.session.screenshots || [];

    // Single-pass filtering
    results = results.filter((screenshot) => {
      // Activity filter
      if (query.activity) {
        const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || '';
        if (!activity.includes(query.activity.toLowerCase())) {
          return false;
        }
      }

      // Text search (extractedText and summary)
      if (query.text) {
        const searchText = query.text.toLowerCase();
        const extractedText = screenshot.aiAnalysis?.extractedText?.toLowerCase() || '';
        const summary = screenshot.aiAnalysis?.summary?.toLowerCase() || '';

        if (!extractedText.includes(searchText) && !summary.includes(searchText)) {
          return false;
        }
      }

      // Key elements search
      if (query.elements && query.elements.length > 0) {
        const keyElements = screenshot.aiAnalysis?.keyElements || [];
        const hasMatch = query.elements.some((element) =>
          keyElements.some((key) =>
            key.toLowerCase().includes(element.toLowerCase())
          )
        );
        if (!hasMatch) {
          return false;
        }
      }

      // Achievement filter
      if (query.hasAchievements) {
        const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
        if (achievements.length === 0) {
          return false;
        }
      }

      // Blocker filter
      if (query.hasBlockers) {
        const blockers = screenshot.aiAnalysis?.progressIndicators?.blockers || [];
        if (blockers.length === 0) {
          return false;
        }
      }

      // Curiosity score filter
      if (query.minCuriosity !== undefined) {
        const curiosity = screenshot.aiAnalysis?.curiosity || 0;
        if (curiosity < query.minCuriosity) {
          return false;
        }
      }

      // Time range filter
      if (query.since) {
        const screenshotTime = new Date(screenshot.timestamp).getTime();
        const sinceTime = new Date(query.since).getTime();
        if (screenshotTime < sinceTime) {
          return false;
        }
      }

      if (query.until) {
        const screenshotTime = new Date(screenshot.timestamp).getTime();
        const untilTime = new Date(query.until).getTime();
        if (screenshotTime > untilTime) {
          return false;
        }
      }

      return true;
    });

    // Apply focus filter if set
    if (this.focusFilter) {
      results = this.applyFocusFilter(results);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Limit results
    if (query.limit !== undefined && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Search audio segments with filtering and optional focus filter.
   *
   * Applies all query filters in a single pass for efficiency:
   * 1. Text search (transcription)
   * 2. Key phrases search
   * 3. Sentiment filtering
   * 4. Task/blocker filtering
   * 5. Time range filtering
   * 6. Focus filter application (if applicable)
   * 7. Sort by timestamp (newest first)
   * 8. Limit results
   *
   * Performance: <1ms for typical sessions (10-100 audio segments)
   *
   * @param query - Audio query with filters
   * @returns Filtered audio segments sorted by timestamp (newest first)
   *
   * @example
   * ```typescript
   * const audio = provider.searchAudioSegments({
   *   text: 'bug',
   *   sentiment: 'negative',
   *   containsBlocker: true,
   *   limit: 5
   * });
   * ```
   */
  searchAudioSegments(query: AudioQuery): SessionAudioSegment[] {
    let results = this.session.audioSegments || [];

    // Single-pass filtering
    results = results.filter((segment) => {
      // Text search (transcription)
      if (query.text) {
        const searchText = query.text.toLowerCase();
        const transcription = segment.transcription?.toLowerCase() || '';

        if (!transcription.includes(searchText)) {
          return false;
        }
      }

      // Key phrases search
      if (query.phrases && query.phrases.length > 0) {
        const keyPhrases = segment.keyPhrases || [];
        const hasMatch = query.phrases.some((phrase) =>
          keyPhrases.some((key) =>
            key.toLowerCase().includes(phrase.toLowerCase())
          )
        );
        if (!hasMatch) {
          return false;
        }
      }

      // Sentiment filter
      if (query.sentiment) {
        if (segment.sentiment !== query.sentiment) {
          return false;
        }
      }

      // Task filter
      if (query.containsTask !== undefined) {
        if (segment.containsTask !== query.containsTask) {
          return false;
        }
      }

      // Blocker filter
      if (query.containsBlocker !== undefined) {
        if (segment.containsBlocker !== query.containsBlocker) {
          return false;
        }
      }

      // Time range filter
      if (query.since) {
        const segmentTime = new Date(segment.timestamp).getTime();
        const sinceTime = new Date(query.since).getTime();
        if (segmentTime < sinceTime) {
          return false;
        }
      }

      if (query.until) {
        const segmentTime = new Date(segment.timestamp).getTime();
        const untilTime = new Date(query.until).getTime();
        if (segmentTime > untilTime) {
          return false;
        }
      }

      return true;
    });

    // Note: Focus filter is primarily for screenshots, but we apply keywords if present
    if (this.focusFilter) {
      results = this.applyAudioFocusFilter(results);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Limit results
    if (query.limit !== undefined && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get recent activity (screenshots + audio) in chronological order.
   *
   * Merges screenshots and audio segments, sorts by timestamp (newest first),
   * and limits to N items.
   *
   * Use this for displaying recent session activity in UI.
   *
   * Performance: <1ms for typical sessions
   *
   * @param limit - Maximum number of items to return
   * @returns Timeline items sorted by timestamp (newest first)
   *
   * @example
   * ```typescript
   * const recent = provider.getRecentActivity(20);
   *
   * recent.forEach(item => {
   *   if (item.type === 'screenshot') {
   *     console.log('Screenshot:', item.data);
   *   } else {
   *     console.log('Audio:', item.data);
   *   }
   * });
   * ```
   */
  getRecentActivity(limit: number): TimelineItem[] {
    const items: TimelineItem[] = [];

    // Add screenshots
    const screenshots = this.session.screenshots || [];
    screenshots.forEach((screenshot) => {
      items.push({
        type: 'screenshot',
        timestamp: screenshot.timestamp,
        data: screenshot,
      });
    });

    // Add audio segments
    const audioSegments = this.session.audioSegments || [];
    audioSegments.forEach((segment) => {
      items.push({
        type: 'audio',
        timestamp: segment.timestamp,
        data: segment,
      });
    });

    // Apply focus filter if set
    const filteredItems = this.applyTimelineFocusFilter(items);

    // Sort by timestamp (newest first)
    filteredItems.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Limit results
    return filteredItems.slice(0, limit);
  }

  /**
   * Get activity since a specific timestamp.
   *
   * Returns all screenshots and audio segments since the given timestamp,
   * sorted chronologically (oldest first).
   *
   * Use this for getting updates since last check or for building timeline views.
   *
   * Performance: <1ms for typical sessions
   *
   * @param timestamp - ISO timestamp to filter from
   * @returns Timeline items sorted by timestamp (oldest first)
   *
   * @example
   * ```typescript
   * const since = provider.getActivitySince('2025-11-02T10:00:00Z');
   *
   * console.log(`${since.length} items since 10am`);
   * ```
   */
  getActivitySince(timestamp: string): TimelineItem[] {
    const items: TimelineItem[] = [];
    const sinceTime = new Date(timestamp).getTime();

    // Add screenshots since timestamp
    const screenshots = this.session.screenshots || [];
    screenshots.forEach((screenshot) => {
      const screenshotTime = new Date(screenshot.timestamp).getTime();
      if (screenshotTime >= sinceTime) {
        items.push({
          type: 'screenshot',
          timestamp: screenshot.timestamp,
          data: screenshot,
        });
      }
    });

    // Add audio segments since timestamp
    const audioSegments = this.session.audioSegments || [];
    audioSegments.forEach((segment) => {
      const segmentTime = new Date(segment.timestamp).getTime();
      if (segmentTime >= sinceTime) {
        items.push({
          type: 'audio',
          timestamp: segment.timestamp,
          data: segment,
        });
      }
    });

    // Apply focus filter if set
    const filteredItems = this.applyTimelineFocusFilter(items);

    // Sort by timestamp (oldest first for chronological order)
    filteredItems.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return filteredItems;
  }

  /**
   * Filter timeline items by activity type.
   *
   * Returns screenshots with the specified detected activity.
   * Audio segments are excluded as they don't have activity classification.
   *
   * @param activityType - Activity type to filter (case-insensitive)
   * @returns Timeline items with matching activity
   *
   * @example
   * ```typescript
   * const codingActivity = provider.filterByActivity('coding');
   * ```
   */
  filterByActivity(activityType: string): TimelineItem[] {
    const screenshots = this.session.screenshots || [];
    const activityLower = activityType.toLowerCase();

    const matchingScreenshots = screenshots.filter((screenshot) => {
      const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || '';
      return activity.includes(activityLower);
    });

    // Convert to timeline items
    const items: TimelineItem[] = matchingScreenshots.map((screenshot) => ({
      type: 'screenshot',
      timestamp: screenshot.timestamp,
      data: screenshot,
    }));

    // Sort by timestamp (newest first)
    items.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return items;
  }

  /**
   * Get aggregated progress indicators (achievements, blockers, insights).
   *
   * Aggregates and deduplicates all progress indicators from screenshots.
   * Optionally filters by time range.
   *
   * Use this for generating progress summaries or session reports.
   *
   * Performance: <1ms for typical sessions
   *
   * @param since - Optional ISO timestamp to filter from
   * @returns Progress summary with deduplicated items
   *
   * @example
   * ```typescript
   * // All progress indicators
   * const progress = provider.getProgressIndicators();
   *
   * // Progress since 10am
   * const todayProgress = provider.getProgressIndicators('2025-11-02T10:00:00Z');
   *
   * console.log('Achievements:', progress.achievements);
   * console.log('Blockers:', progress.blockers);
   * console.log('Insights:', progress.insights);
   * ```
   */
  getProgressIndicators(since?: string): ProgressSummary {
    let screenshots = this.session.screenshots || [];

    // Filter by time if specified
    if (since) {
      const sinceTime = new Date(since).getTime();
      screenshots = screenshots.filter((screenshot) => {
        const screenshotTime = new Date(screenshot.timestamp).getTime();
        return screenshotTime >= sinceTime;
      });
    }

    // Apply focus filter if set
    if (this.focusFilter) {
      screenshots = this.applyFocusFilter(screenshots);
    }

    // Aggregate progress indicators
    const achievementsSet = new Set<string>();
    const blockersSet = new Set<string>();
    const insightsSet = new Set<string>();

    screenshots.forEach((screenshot) => {
      const indicators = screenshot.aiAnalysis?.progressIndicators;
      if (indicators) {
        // Add achievements
        if (indicators.achievements) {
          indicators.achievements.forEach((achievement) => {
            achievementsSet.add(achievement);
          });
        }

        // Add blockers
        if (indicators.blockers) {
          indicators.blockers.forEach((blocker) => {
            blockersSet.add(blocker);
          });
        }

        // Add insights
        if (indicators.insights) {
          indicators.insights.forEach((insight) => {
            insightsSet.add(insight);
          });
        }
      }
    });

    return {
      achievements: Array.from(achievementsSet),
      blockers: Array.from(blockersSet),
      insights: Array.from(insightsSet),
    };
  }

  /**
   * Apply focus filter to screenshots.
   *
   * Filters screenshots based on focus filter criteria:
   * - Activities (include/exclude)
   * - Keywords (in extractedText, summary, keyElements)
   * - Curiosity score
   * - Achievements/blockers
   * - Time range
   *
   * @param screenshots - Screenshots to filter
   * @returns Filtered screenshots
   *
   * @private
   */
  private applyFocusFilter(screenshots: SessionScreenshot[]): SessionScreenshot[] {
    if (!this.focusFilter) {
      return screenshots;
    }

    return screenshots.filter((screenshot) => {
      // Activities filter (include)
      if (this.focusFilter!.activities && this.focusFilter!.activities.length > 0) {
        const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || '';
        const hasMatch = this.focusFilter!.activities.some((act) =>
          activity.includes(act.toLowerCase())
        );
        if (!hasMatch) {
          return false;
        }
      }

      // Activities filter (exclude)
      if (this.focusFilter!.excludeActivities && this.focusFilter!.excludeActivities.length > 0) {
        const activity = screenshot.aiAnalysis?.detectedActivity?.toLowerCase() || '';
        const hasMatch = this.focusFilter!.excludeActivities.some((act) =>
          activity.includes(act.toLowerCase())
        );
        if (hasMatch) {
          return false;
        }
      }

      // Keywords filter
      if (this.focusFilter!.keywords && this.focusFilter!.keywords.length > 0) {
        const extractedText = screenshot.aiAnalysis?.extractedText?.toLowerCase() || '';
        const summary = screenshot.aiAnalysis?.summary?.toLowerCase() || '';
        const keyElements = screenshot.aiAnalysis?.keyElements || [];
        const keyElementsText = keyElements.join(' ').toLowerCase();

        const hasMatch = this.focusFilter!.keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          return (
            extractedText.includes(keywordLower) ||
            summary.includes(keywordLower) ||
            keyElementsText.includes(keywordLower)
          );
        });

        if (!hasMatch) {
          return false;
        }
      }

      // Curiosity score filter
      if (this.focusFilter!.minCuriosity !== undefined) {
        const curiosity = screenshot.aiAnalysis?.curiosity || 0;
        if (curiosity < this.focusFilter!.minCuriosity) {
          return false;
        }
      }

      // Achievements filter
      if (this.focusFilter!.hasAchievements) {
        const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
        if (achievements.length === 0) {
          return false;
        }
      }

      // Blockers filter
      if (this.focusFilter!.hasBlockers) {
        const blockers = screenshot.aiAnalysis?.progressIndicators?.blockers || [];
        if (blockers.length === 0) {
          return false;
        }
      }

      // Time range filter
      if (this.focusFilter!.since) {
        const screenshotTime = new Date(screenshot.timestamp).getTime();
        const sinceTime = new Date(this.focusFilter!.since).getTime();
        if (screenshotTime < sinceTime) {
          return false;
        }
      }

      if (this.focusFilter!.until) {
        const screenshotTime = new Date(screenshot.timestamp).getTime();
        const untilTime = new Date(this.focusFilter!.until).getTime();
        if (screenshotTime > untilTime) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply focus filter to audio segments.
   *
   * Filters audio segments based on applicable focus filter criteria:
   * - Keywords (in transcription, keyPhrases)
   * - Tasks/blockers
   * - Time range
   *
   * Note: Activities are not applicable to audio segments.
   *
   * @param segments - Audio segments to filter
   * @returns Filtered audio segments
   *
   * @private
   */
  private applyAudioFocusFilter(segments: SessionAudioSegment[]): SessionAudioSegment[] {
    if (!this.focusFilter) {
      return segments;
    }

    return segments.filter((segment) => {
      // Keywords filter
      if (this.focusFilter!.keywords && this.focusFilter!.keywords.length > 0) {
        const transcription = segment.transcription?.toLowerCase() || '';
        const keyPhrases = segment.keyPhrases || [];
        const keyPhrasesText = keyPhrases.join(' ').toLowerCase();

        const hasMatch = this.focusFilter!.keywords.some((keyword) => {
          const keywordLower = keyword.toLowerCase();
          return (
            transcription.includes(keywordLower) ||
            keyPhrasesText.includes(keywordLower)
          );
        });

        if (!hasMatch) {
          return false;
        }
      }

      // Blockers filter
      if (this.focusFilter!.hasBlockers) {
        if (!segment.containsBlocker) {
          return false;
        }
      }

      // Time range filter
      if (this.focusFilter!.since) {
        const segmentTime = new Date(segment.timestamp).getTime();
        const sinceTime = new Date(this.focusFilter!.since).getTime();
        if (segmentTime < sinceTime) {
          return false;
        }
      }

      if (this.focusFilter!.until) {
        const segmentTime = new Date(segment.timestamp).getTime();
        const untilTime = new Date(this.focusFilter!.until).getTime();
        if (segmentTime > untilTime) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply focus filter to timeline items.
   *
   * Applies appropriate focus filter based on item type (screenshot or audio).
   *
   * @param items - Timeline items to filter
   * @returns Filtered timeline items
   *
   * @private
   */
  private applyTimelineFocusFilter(items: TimelineItem[]): TimelineItem[] {
    if (!this.focusFilter) {
      return items;
    }

    return items.filter((item) => {
      if (item.type === 'screenshot') {
        const filtered = this.applyFocusFilter([item.data as SessionScreenshot]);
        return filtered.length > 0;
      } else {
        const filtered = this.applyAudioFocusFilter([item.data as SessionAudioSegment]);
        return filtered.length > 0;
      }
    });
  }
}
