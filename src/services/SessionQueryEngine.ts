/**
 * SessionQueryEngine - Core Query Routing and Execution
 *
 * The SessionQueryEngine is the central interface for querying session data.
 * It supports three query types:
 * 1. Structured Queries - Predefined filters and criteria
 * 2. Natural Language Queries - AI-powered question answering
 * 3. Aggregation Queries - Statistical analysis and grouping
 *
 * ARCHITECTURE:
 * - Type-safe query routing using TypeScript type guards
 * - Consistent QueryResult format across all query types
 * - Placeholder handlers ready for future implementation
 * - Comprehensive error handling with user-friendly messages
 *
 * USAGE:
 * ```typescript
 * const engine = new SessionQueryEngine();
 *
 * // Set active session for querying
 * engine.setActiveSession(session);
 *
 * // Structured query
 * const result = await engine.query({
 *   activity: ['coding'],
 *   hasBlockers: true,
 *   timeRange: { minutes: 60 }
 * });
 *
 * // Natural language query
 * const result = await engine.query({
 *   question: "What did I work on yesterday?",
 *   context: 'summary'
 * });
 *
 * // Aggregation query
 * const result = await engine.query({
 *   groupBy: 'activity',
 *   metrics: ['duration', 'screenshot_count']
 * });
 * ```
 *
 * @module SessionQueryEngine
 */

import { LiveSessionContextProvider } from './LiveSessionContextProvider';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../types';
import type {
  SessionFocusFilter,
  ScreenshotQuery,
  AudioQuery,
} from './LiveSessionContextProvider';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Structured query for filtering sessions with predefined criteria.
 *
 * Supports:
 * - Activity filtering (coding, meetings, research, etc.)
 * - Keyword search across session metadata
 * - Blocker and achievement detection
 * - Time range filtering (relative or absolute)
 * - Curiosity score range (AI-determined interest level)
 * - Result limiting
 *
 * @example
 * ```typescript
 * const query: StructuredQuery = {
 *   activity: ['coding', 'debugging'],
 *   keywords: ['authentication', 'bug'],
 *   hasBlockers: true,
 *   timeRange: { start: new Date('2025-11-01'), end: new Date('2025-11-02') },
 *   limit: 10
 * };
 * ```
 */
export interface StructuredQuery {
  /**
   * Filter by detected activities (e.g., 'coding', 'meetings', 'research')
   */
  activity?: string[];

  /**
   * Search keywords in session name, description, tags, and AI analyses
   */
  keywords?: string[];

  /**
   * Filter sessions that contain blockers
   */
  hasBlockers?: boolean;

  /**
   * Filter sessions that contain achievements
   */
  hasAchievements?: boolean;

  /**
   * Time range filter - either relative minutes or absolute date range
   */
  timeRange?: { minutes: number } | { start: Date; end: Date };

  /**
   * Filter by curiosity score range (0-100, AI-determined interest level)
   */
  curiosity?: { min: number; max: number };

  /**
   * Maximum number of results to return
   */
  limit?: number;
}

/**
 * Natural language query for AI-powered question answering.
 *
 * Uses Claude AI to interpret questions and search session data.
 * Context parameter controls response detail level.
 *
 * @example
 * ```typescript
 * const query: NaturalQuery = {
 *   question: "What bugs did I fix last week?",
 *   context: 'detailed'
 * };
 * ```
 */
export interface NaturalQuery {
  /**
   * Natural language question about sessions
   */
  question: string;

  /**
   * Response detail level
   * - 'summary': Brief overview
   * - 'detailed': Full details
   * - 'timeline': Chronological narrative
   */
  context?: 'summary' | 'detailed' | 'timeline';
}

/**
 * Aggregation query for statistical analysis and grouping.
 *
 * Groups sessions by specified dimension and calculates metrics.
 * Useful for analytics, reporting, and insights.
 *
 * @example
 * ```typescript
 * const query: AggregationQuery = {
 *   groupBy: 'activity',
 *   metrics: ['duration', 'screenshot_count'],
 *   timeRange: { start: new Date('2025-11-01'), end: new Date('2025-11-07') }
 * };
 * ```
 */
export interface AggregationQuery {
  /**
   * Dimension to group by
   * - 'activity': Group by detected activity type
   * - 'hour': Group by hour of day
   * - 'topic': Group by topic/tag
   */
  groupBy: 'activity' | 'hour' | 'topic';

  /**
   * Metrics to calculate for each group
   * - 'duration': Total time in minutes
   * - 'screenshot_count': Number of screenshots
   * - 'blocker_count': Number of blockers detected
   */
  metrics: Array<'duration' | 'screenshot_count' | 'blocker_count'>;

  /**
   * Optional time range filter for aggregation
   */
  timeRange?: { start: Date; end: Date };
}

/**
 * Union type of all supported query types.
 * Used for type-safe query routing.
 */
export type Query = StructuredQuery | NaturalQuery | AggregationQuery;

/**
 * Result of a query execution.
 *
 * Structure varies by query type:
 * - Structured: data contains filtered sessions
 * - Natural: answer contains AI response, sources lists session IDs
 * - Aggregation: data contains grouped statistics
 *
 * All results include optional error field for partial failures.
 */
export interface QueryResult {
  /**
   * Query result data (structure varies by query type)
   */
  data?: unknown;

  /**
   * Natural language answer (for NaturalQuery)
   */
  answer?: string;

  /**
   * Confidence score for AI-generated results (0-1)
   */
  confidence?: number;

  /**
   * Source session IDs referenced in result
   */
  sources?: string[];

  /**
   * Error message if query failed or partially failed
   */
  error?: string;

  /**
   * Query execution time in milliseconds
   */
  elapsedMs?: number;
}

/**
 * Custom error class for query execution failures.
 *
 * Provides structured error information:
 * - Technical message for logging
 * - User-friendly message for UI
 * - Error code for programmatic handling
 */
export class QueryError extends Error {
  /**
   * User-friendly error message
   */
  public readonly userMessage: string;

  /**
   * Error code for programmatic handling
   */
  public readonly code: string;

  /**
   * Create a new QueryError
   *
   * @param message - Technical error message
   * @param userMessage - User-friendly error message
   * @param code - Error code
   */
  constructor(message: string, userMessage: string, code: string) {
    super(message);
    this.name = 'QueryError';
    this.userMessage = userMessage;
    this.code = code;
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if query is a StructuredQuery.
 *
 * @param query - Query to check
 * @returns True if query is StructuredQuery
 */
function isStructuredQuery(query: Query): query is StructuredQuery {
  return (
    'activity' in query ||
    'keywords' in query ||
    'hasBlockers' in query ||
    'hasAchievements' in query ||
    'curiosity' in query ||
    ('timeRange' in query && !('groupBy' in query)) ||
    'limit' in query
  );
}

/**
 * Type guard to check if query is a NaturalQuery.
 *
 * @param query - Query to check
 * @returns True if query is NaturalQuery
 */
function isNaturalQuery(query: Query): query is NaturalQuery {
  return 'question' in query;
}

/**
 * Type guard to check if query is an AggregationQuery.
 *
 * @param query - Query to check
 * @returns True if query is AggregationQuery
 */
function isAggregationQuery(query: Query): query is AggregationQuery {
  return 'groupBy' in query && 'metrics' in query;
}

// =============================================================================
// SESSION QUERY ENGINE
// =============================================================================

/**
 * SessionQueryEngine - Core query routing and execution engine.
 *
 * The SessionQueryEngine provides a unified interface for querying session data
 * using three different query types: structured, natural language, and aggregation.
 *
 * DESIGN PRINCIPLES:
 * - Type-safe query routing using TypeScript discriminated unions
 * - Consistent QueryResult format across all query types
 * - Graceful error handling with user-friendly messages
 * - Extensible architecture for future query types
 *
 * IMPLEMENTATION STATUS:
 * - Query routing: COMPLETE
 * - Type guards: COMPLETE
 * - Error handling: COMPLETE
 * - Structured query handler: COMPLETE (Phase 1, Task P1-T03)
 * - Natural language handler: PLACEHOLDER (Phase 2)
 * - Aggregation handler: PLACEHOLDER (Phase 2)
 *
 * @example
 * ```typescript
 * const engine = new SessionQueryEngine();
 *
 * // Set active session for querying
 * engine.setActiveSession(session);
 *
 * // Structured query
 * const blockerSessions = await engine.query({
 *   hasBlockers: true,
 *   timeRange: { minutes: 1440 } // Last 24 hours
 * });
 *
 * // Natural language query
 * const answer = await engine.query({
 *   question: "What did I accomplish today?",
 *   context: 'summary'
 * });
 *
 * // Aggregation query
 * const stats = await engine.query({
 *   groupBy: 'activity',
 *   metrics: ['duration', 'screenshot_count']
 * });
 * ```
 */
export class SessionQueryEngine {
  private sessionProvider?: LiveSessionContextProvider;

  /**
   * Create a new SessionQueryEngine instance.
   *
   * @example
   * ```typescript
   * const engine = new SessionQueryEngine();
   * ```
   */
  constructor() {
    // Currently no initialization required
    // Future: May accept configuration options (cache settings, AI model selection, etc.)
  }

  /**
   * Set the active session for querying.
   * Must be called before query() for structured queries.
   *
   * @param session - Session to query
   *
   * @example
   * ```typescript
   * engine.setActiveSession(session);
   * const result = await engine.query({ hasBlockers: true });
   * ```
   */
  public setActiveSession(session: Session): void {
    this.sessionProvider = new LiveSessionContextProvider(session);
  }

  /**
   * Set focus filter (narrows AI's attention).
   * Requires an active session to be set first.
   *
   * @param filter - Focus filter to apply
   * @throws QueryError if no active session is set
   *
   * @example
   * ```typescript
   * engine.setActiveSession(session);
   * engine.setFocusFilter({
   *   activities: ['coding'],
   *   minCuriosity: 0.7
   * });
   * ```
   */
  public setFocusFilter(filter: SessionFocusFilter): void {
    if (!this.sessionProvider) {
      throw new QueryError(
        'No active session set. Call setActiveSession() first.',
        'Cannot set focus filter without an active session',
        'NO_ACTIVE_SESSION'
      );
    }

    // Get current session from provider
    const currentSession = this.getSession();

    // Create new provider with focus filter
    this.sessionProvider = new LiveSessionContextProvider(currentSession, filter);
  }

  /**
   * Get the current session from the provider.
   * Internal helper method.
   *
   * @returns Current session
   * @throws QueryError if no active session is set
   * @private
   */
  private getSession(): Session {
    if (!this.sessionProvider) {
      throw new QueryError(
        'No active session set',
        'Cannot get session without setting one first',
        'NO_ACTIVE_SESSION'
      );
    }

    // Access the session via the provider's private field
    // This is a TypeScript workaround - in production we'd add a getSession() method to LiveSessionContextProvider
    return (this.sessionProvider as any).session;
  }

  /**
   * Execute a query and return results.
   *
   * This is the main entry point for all queries. It automatically detects
   * the query type and routes to the appropriate handler method.
   *
   * QUERY TYPE DETECTION:
   * 1. Check for NaturalQuery ('question' field)
   * 2. Check for AggregationQuery ('groupBy' + 'metrics' fields)
   * 3. Default to StructuredQuery (any other fields)
   *
   * ERROR HANDLING:
   * - Invalid query structure throws QueryError
   * - Handler errors are caught and returned in QueryResult.error
   * - User-friendly error messages for UI display
   *
   * @param query - Query to execute (StructuredQuery | NaturalQuery | AggregationQuery)
   * @returns Promise resolving to QueryResult
   * @throws QueryError if query is invalid
   *
   * @example
   * ```typescript
   * // Structured query
   * const result = await engine.query({
   *   activity: ['coding'],
   *   hasBlockers: true
   * });
   *
   * if (result.error) {
   *   console.error('Query failed:', result.error);
   * } else {
   *   console.log('Found sessions:', result.data);
   * }
   * ```
   */
  async query(query: Query): Promise<QueryResult> {
    try {
      // Validate query is not empty
      if (!query || typeof query !== 'object' || Object.keys(query).length === 0) {
        throw new QueryError(
          'Query object is empty or invalid',
          'Please provide a valid query',
          'INVALID_QUERY'
        );
      }

      // Route to appropriate handler based on query type
      if (isNaturalQuery(query)) {
        return await this.naturalLanguageQuery(query);
      } else if (isAggregationQuery(query)) {
        return await this.aggregationQuery(query);
      } else if (isStructuredQuery(query)) {
        return await this.structuredQuery(query);
      } else {
        // Unknown query type
        throw new QueryError(
          'Unrecognized query type',
          'Query format is not supported',
          'UNKNOWN_QUERY_TYPE'
        );
      }
    } catch (error) {
      // Convert errors to QueryResult with error field
      if (error instanceof QueryError) {
        return {
          error: error.userMessage,
        };
      }

      // Unexpected error
      const message = error instanceof Error ? error.message : String(error);
      return {
        error: `Query execution failed: ${message}`,
      };
    }
  }

  /**
   * Execute a structured query with predefined filters.
   *
   * IMPLEMENTATION STATUS: COMPLETE (Phase 1, Task P1-T03)
   *
   * FEATURES:
   * - Filter by activity types (coding, meetings, research, etc.)
   * - Keyword search across session metadata and AI analyses
   * - Blocker and achievement detection
   * - Time range filtering (relative and absolute)
   * - Curiosity score filtering
   * - Result limiting with relevance-based sorting
   *
   * PERFORMANCE:
   * - Target: <200ms for complex queries
   * - Uses in-memory filtering via LiveSessionContextProvider
   * - Relevance-based scoring for result ordering
   *
   * @param query - Structured query with filters
   * @returns Promise resolving to QueryResult with filtered sessions
   *
   * @example
   * ```typescript
   * engine.setActiveSession(session);
   * const result = await engine.query({
   *   activity: ['coding', 'debugging'],
   *   keywords: ['authentication'],
   *   hasBlockers: true,
   *   timeRange: { minutes: 1440 },
   *   limit: 10
   * });
   * ```
   */
  private async structuredQuery(query: StructuredQuery): Promise<QueryResult> {
    // Performance tracking
    const startTime = Date.now();

    // Validate query parameters
    if (query.curiosity) {
      if (query.curiosity.min < 0 || query.curiosity.min > 100) {
        throw new QueryError(
          'Curiosity min must be between 0 and 100',
          'Please provide a valid curiosity score range',
          'INVALID_CURIOSITY_RANGE'
        );
      }
      if (query.curiosity.max < 0 || query.curiosity.max > 100) {
        throw new QueryError(
          'Curiosity max must be between 0 and 100',
          'Please provide a valid curiosity score range',
          'INVALID_CURIOSITY_RANGE'
        );
      }
      if (query.curiosity.min > query.curiosity.max) {
        throw new QueryError(
          'Curiosity min cannot be greater than max',
          'Please provide a valid curiosity score range',
          'INVALID_CURIOSITY_RANGE'
        );
      }
    }

    if (query.limit !== undefined && query.limit < 1) {
      throw new QueryError(
        'Limit must be greater than 0',
        'Please provide a valid limit',
        'INVALID_LIMIT'
      );
    }

    // Validate time range if specified
    if (query.timeRange && 'start' in query.timeRange && 'end' in query.timeRange) {
      if (query.timeRange.start >= query.timeRange.end) {
        throw new QueryError(
          'Start date must be before end date',
          'Please provide a valid time range',
          'INVALID_TIME_RANGE'
        );
      }
    }

    // Check if session provider is set
    if (!this.sessionProvider) {
      throw new QueryError(
        'No active session set for structured query',
        'Please call setActiveSession() before querying',
        'NO_ACTIVE_SESSION'
      );
    }

    // Handle empty query - return recent activity
    const hasFilters = query.activity || query.keywords || query.hasBlockers !== undefined ||
                      query.hasAchievements !== undefined || query.curiosity || query.timeRange;

    if (!hasFilters) {
      // Return recent activity (last 20 items by default)
      const recentItems = this.sessionProvider.getRecentActivity(query.limit || 20);
      const screenshots = recentItems
        .filter((item) => item.type === 'screenshot')
        .map((item) => item.data as SessionScreenshot);
      const audioSegments = recentItems
        .filter((item) => item.type === 'audio')
        .map((item) => item.data as SessionAudioSegment);

      return {
        data: {
          screenshots,
          audioSegments,
          count: screenshots.length + audioSegments.length,
        },
        sources: [
          ...screenshots.map((s) => s.id),
          ...audioSegments.map((a) => a.id),
        ],
      };
    }

    // Build screenshot query from structured query parameters
    const screenshotQuery: ScreenshotQuery = {};

    // Activity filter - take first activity if multiple
    if (query.activity && query.activity.length > 0) {
      screenshotQuery.activity = query.activity[0];
    }

    // Keywords filter - combine into text search
    if (query.keywords && query.keywords.length > 0) {
      screenshotQuery.text = query.keywords.join(' ');
    }

    // Achievement/blocker filters
    if (query.hasAchievements !== undefined) {
      screenshotQuery.hasAchievements = query.hasAchievements;
    }
    if (query.hasBlockers !== undefined) {
      screenshotQuery.hasBlockers = query.hasBlockers;
    }

    // Curiosity score filter
    if (query.curiosity) {
      screenshotQuery.minCuriosity = query.curiosity.min / 100; // Convert 0-100 to 0-1
      // Note: LiveSessionContextProvider only supports minCuriosity, not maxCuriosity
      // We'll filter max curiosity after getting results
    }

    // Time range filter
    if (query.timeRange) {
      if ('minutes' in query.timeRange) {
        // Relative time (last N minutes)
        const since = new Date(Date.now() - query.timeRange.minutes * 60 * 1000);
        screenshotQuery.since = since.toISOString();
      } else {
        // Absolute time range
        screenshotQuery.since = query.timeRange.start.toISOString();
        screenshotQuery.until = query.timeRange.end.toISOString();
      }
    }

    // Limit results
    if (query.limit) {
      screenshotQuery.limit = query.limit;
    }

    // Search screenshots using LiveSessionContextProvider
    let screenshots = this.sessionProvider.searchScreenshots(screenshotQuery);

    // Apply max curiosity filter if specified (not supported by LiveSessionContextProvider)
    if (query.curiosity && query.curiosity.max !== undefined) {
      const maxCuriosity = query.curiosity.max / 100;
      screenshots = screenshots.filter((screenshot) => {
        const curiosity = screenshot.aiAnalysis?.curiosity || 0;
        return curiosity <= maxCuriosity;
      });
    }

    // Build audio query with similar criteria
    const audioQuery: AudioQuery = {};

    // Keywords filter
    if (query.keywords && query.keywords.length > 0) {
      audioQuery.text = query.keywords.join(' ');
    }

    // Blocker filter (audio doesn't have achievements)
    if (query.hasBlockers !== undefined) {
      audioQuery.containsBlocker = query.hasBlockers;
    }

    // Time range filter
    if (query.timeRange) {
      if ('minutes' in query.timeRange) {
        const since = new Date(Date.now() - query.timeRange.minutes * 60 * 1000);
        audioQuery.since = since.toISOString();
      } else {
        audioQuery.since = query.timeRange.start.toISOString();
        audioQuery.until = query.timeRange.end.toISOString();
      }
    }

    // Limit audio results
    if (query.limit) {
      audioQuery.limit = query.limit;
    }

    // Search audio segments
    let audioSegments = this.sessionProvider.searchAudioSegments(audioQuery);

    // Calculate relevance scores and sort by relevance
    const scoredScreenshots = screenshots.map((screenshot) => ({
      item: screenshot,
      score: this.calculateRelevanceScore(screenshot, query),
    }));

    const scoredAudio = audioSegments.map((audio) => ({
      item: audio,
      score: this.calculateAudioRelevanceScore(audio, query),
    }));

    // Sort by relevance score (highest first)
    scoredScreenshots.sort((a, b) => b.score - a.score);
    scoredAudio.sort((a, b) => b.score - a.score);

    // Extract sorted items
    screenshots = scoredScreenshots.map((s) => s.item);
    audioSegments = scoredAudio.map((a) => a.item);

    // Apply limit across both types if specified
    if (query.limit) {
      const totalItems = screenshots.length + audioSegments.length;
      if (totalItems > query.limit) {
        // Distribute limit proportionally
        const screenshotRatio = screenshots.length / totalItems;
        const screenshotLimit = Math.ceil(query.limit * screenshotRatio);
        const audioLimit = query.limit - screenshotLimit;

        screenshots = screenshots.slice(0, screenshotLimit);
        audioSegments = audioSegments.slice(0, audioLimit);
      }
    }

    // Calculate elapsed time
    const elapsedTime = Date.now() - startTime;

    // Build result
    const result: QueryResult = {
      data: {
        screenshots,
        audioSegments,
        count: screenshots.length + audioSegments.length,
        elapsedMs: elapsedTime,
      },
      sources: [
        ...screenshots.map((s) => s.id),
        ...audioSegments.map((a) => a.id),
      ],
    };

    return result;
  }

  /**
   * Calculate relevance score for a screenshot based on query criteria.
   *
   * Scoring factors:
   * - Has blockers: +10 points
   * - Has achievements: +8 points
   * - High curiosity (>0.7): +5 points
   * - Medium curiosity (0.5-0.7): +3 points
   * - Recent timestamp (last hour): +4 points
   * - Recent timestamp (last day): +2 points
   *
   * @param screenshot - Screenshot to score
   * @param query - Query criteria
   * @returns Relevance score (0-100)
   * @private
   */
  private calculateRelevanceScore(
    screenshot: SessionScreenshot,
    query: StructuredQuery
  ): number {
    let score = 0;

    // Blocker relevance
    if (query.hasBlockers) {
      const blockers = screenshot.aiAnalysis?.progressIndicators?.blockers || [];
      if (blockers.length > 0) {
        score += 10;
      }
    }

    // Achievement relevance
    if (query.hasAchievements) {
      const achievements = screenshot.aiAnalysis?.progressIndicators?.achievements || [];
      if (achievements.length > 0) {
        score += 8;
      }
    }

    // Curiosity score relevance
    const curiosity = screenshot.aiAnalysis?.curiosity || 0;
    if (curiosity > 0.7) {
      score += 5;
    } else if (curiosity > 0.5) {
      score += 3;
    }

    // Recency relevance
    const timestamp = new Date(screenshot.timestamp).getTime();
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    if (timestamp > hourAgo) {
      score += 4;
    } else if (timestamp > dayAgo) {
      score += 2;
    }

    // Keyword match relevance
    if (query.keywords && query.keywords.length > 0) {
      const extractedText = screenshot.aiAnalysis?.extractedText?.toLowerCase() || '';
      const summary = screenshot.aiAnalysis?.summary?.toLowerCase() || '';
      const text = extractedText + ' ' + summary;

      let keywordMatches = 0;
      for (const keyword of query.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }

      // +2 points per keyword match
      score += keywordMatches * 2;
    }

    return score;
  }

  /**
   * Calculate relevance score for an audio segment based on query criteria.
   *
   * Scoring factors:
   * - Contains blocker: +10 points
   * - Contains task: +5 points
   * - Negative sentiment: +3 points (often indicates problems/blockers)
   * - Recent timestamp (last hour): +4 points
   * - Recent timestamp (last day): +2 points
   *
   * @param audio - Audio segment to score
   * @param query - Query criteria
   * @returns Relevance score (0-100)
   * @private
   */
  private calculateAudioRelevanceScore(
    audio: SessionAudioSegment,
    query: StructuredQuery
  ): number {
    let score = 0;

    // Blocker relevance
    if (query.hasBlockers && audio.containsBlocker) {
      score += 10;
    }

    // Task relevance
    if (audio.containsTask) {
      score += 5;
    }

    // Sentiment relevance (negative sentiment often indicates issues)
    if (audio.sentiment === 'negative') {
      score += 3;
    }

    // Recency relevance
    const timestamp = new Date(audio.timestamp).getTime();
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;

    if (timestamp > hourAgo) {
      score += 4;
    } else if (timestamp > dayAgo) {
      score += 2;
    }

    // Keyword match relevance
    if (query.keywords && query.keywords.length > 0) {
      const transcription = audio.transcription?.toLowerCase() || '';

      let keywordMatches = 0;
      for (const keyword of query.keywords) {
        if (transcription.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }

      // +2 points per keyword match
      score += keywordMatches * 2;
    }

    return score;
  }

  /**
   * Execute a natural language query using AI.
   *
   * PLACEHOLDER IMPLEMENTATION - To be implemented in Phase 2.
   *
   * PLANNED FEATURES:
   * - AI-powered question interpretation (via Claude API)
   * - Semantic search across session data
   * - Context-aware responses (summary, detailed, timeline)
   * - Confidence scoring for AI responses
   * - Source attribution (session IDs referenced)
   *
   * IMPLEMENTATION NOTES:
   * - Will integrate with SessionsQueryAgent for AI processing
   * - May use prompt caching for performance
   * - Should handle follow-up questions with context
   *
   * @param query - Natural language query
   * @returns Promise resolving to QueryResult with AI answer
   *
   * @example
   * ```typescript
   * const result = await engine.query({
   *   question: "What bugs did I fix last week?",
   *   context: 'detailed'
   * });
   *
   * console.log(result.answer); // AI-generated answer
   * console.log(result.sources); // Session IDs referenced
   * console.log(result.confidence); // 0-1 confidence score
   * ```
   */
  private async naturalLanguageQuery(query: NaturalQuery): Promise<QueryResult> {
    const startTime = Date.now();

    // Validate query parameters
    if (!query.question || query.question.trim().length === 0) {
      throw new QueryError(
        'Question cannot be empty',
        'Please provide a question',
        'EMPTY_QUESTION'
      );
    }

    if (query.context && !['summary', 'detailed', 'timeline'].includes(query.context)) {
      throw new QueryError(
        `Invalid context: ${query.context}`,
        'Context must be summary, detailed, or timeline',
        'INVALID_CONTEXT'
      );
    }

    // Check if session provider is set
    if (!this.sessionProvider) {
      throw new QueryError(
        'No active session set for natural language query',
        'Please call setActiveSession() before querying',
        'NO_ACTIVE_SESSION'
      );
    }

    // Import invoke for Tauri API calls
    const { invoke } = await import('@tauri-apps/api/core');

    try {
      // Build session context for AI
      const sessionContext = this._buildSessionContext(query.context || 'summary');

      // Build system prompt with query tools
      const systemPrompt = this._buildNaturalQuerySystemPrompt();

      // Build user message with question and context
      const userMessage = `${sessionContext}\n\nUser Question: ${query.question}`;

      // Call Claude API
      const response = await invoke<any>('claude_chat_completion', {
        request: {
          model: 'claude-3-5-sonnet-20241022', // Sonnet 4.5 for accuracy
          maxTokens: 2048,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
          system: systemPrompt,
        },
      });

      // Extract response content
      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';

      // Parse response to extract answer, confidence, and sources
      const parsed = this._parseNaturalQueryResponse(responseText);

      const elapsedMs = Date.now() - startTime;

      return {
        answer: parsed.answer,
        confidence: parsed.confidence,
        sources: parsed.sources,
        elapsedMs,
      };
    } catch (error: any) {
      // Handle API errors
      if (error.message?.includes('API key')) {
        throw new QueryError(
          'Claude API key not configured',
          'Please configure your Claude API key in settings',
          'NO_API_KEY'
        );
      }

      if (error.message?.includes('rate limit')) {
        throw new QueryError(
          'API rate limit exceeded',
          'Please try again in a few moments',
          'RATE_LIMIT'
        );
      }

      // Generic error
      throw new QueryError(
        `Natural language query failed: ${error.message}`,
        'Failed to process question. Please try again.',
        'API_ERROR'
      );
    }
  }

  /**
   * Build session context for natural language queries.
   * Provides AI with relevant session data based on context level.
   *
   * @param contextLevel - Detail level (summary, detailed, timeline)
   * @returns Formatted session context string
   * @private
   */
  private _buildSessionContext(contextLevel: string): string {
    if (!this.sessionProvider) {
      return '';
    }

    const session = this.getSession();
    const recentActivity = this.sessionProvider.getRecentActivity(50);

    let context = `<session_context>\n`;
    context += `<session_info>\n`;
    context += `  <id>${session.id}</id>\n`;
    context += `  <name>${session.name || 'Untitled Session'}</name>\n`;
    context += `  <start_time>${session.startTime}</start_time>\n`;
    if (session.endTime) {
      context += `  <end_time>${session.endTime}</end_time>\n`;
    }
    if (session.description) {
      context += `  <description>${session.description}</description>\n`;
    }
    context += `</session_info>\n\n`;

    if (contextLevel === 'summary') {
      // Summary: Include progress indicators and recent highlights
      const progress = this.sessionProvider.getProgressIndicators();

      if (progress.achievements.length > 0) {
        context += `<achievements>\n`;
        progress.achievements.forEach((achievement) => {
          context += `  - ${achievement}\n`;
        });
        context += `</achievements>\n\n`;
      }

      if (progress.blockers.length > 0) {
        context += `<blockers>\n`;
        progress.blockers.forEach((blocker) => {
          context += `  - ${blocker}\n`;
        });
        context += `</blockers>\n\n`;
      }

      if (progress.insights.length > 0) {
        context += `<insights>\n`;
        progress.insights.slice(0, 5).forEach((insight) => {
          context += `  - ${insight}\n`;
        });
        context += `</insights>\n\n`;
      }

      // Include recent screenshots (last 10)
      const recentScreenshots = recentActivity
        .filter((item) => item.type === 'screenshot')
        .slice(0, 10);

      if (recentScreenshots.length > 0) {
        context += `<recent_screenshots count="${recentScreenshots.length}">\n`;
        recentScreenshots.forEach((item, index) => {
          const screenshot = item.data as SessionScreenshot;
          context += `  <screenshot index="${index}">\n`;
          context += `    <id>${screenshot.id}</id>\n`;
          context += `    <timestamp>${screenshot.timestamp}</timestamp>\n`;
          if (screenshot.aiAnalysis?.detectedActivity) {
            context += `    <activity>${screenshot.aiAnalysis.detectedActivity}</activity>\n`;
          }
          if (screenshot.aiAnalysis?.summary) {
            context += `    <summary>${screenshot.aiAnalysis.summary}</summary>\n`;
          }
          context += `  </screenshot>\n`;
        });
        context += `</recent_screenshots>\n\n`;
      }
    } else if (contextLevel === 'detailed') {
      // Detailed: Include all screenshots and audio segments
      const screenshots = recentActivity.filter((item) => item.type === 'screenshot');
      const audioSegments = recentActivity.filter((item) => item.type === 'audio');

      context += `<screenshots count="${screenshots.length}">\n`;
      screenshots.forEach((item, index) => {
        const screenshot = item.data as SessionScreenshot;
        context += `  <screenshot index="${index}">\n`;
        context += `    <id>${screenshot.id}</id>\n`;
        context += `    <timestamp>${screenshot.timestamp}</timestamp>\n`;
        if (screenshot.aiAnalysis) {
          context += `    <analysis>\n`;
          if (screenshot.aiAnalysis.detectedActivity) {
            context += `      <activity>${screenshot.aiAnalysis.detectedActivity}</activity>\n`;
          }
          if (screenshot.aiAnalysis.summary) {
            context += `      <summary>${screenshot.aiAnalysis.summary}</summary>\n`;
          }
          if (screenshot.aiAnalysis.extractedText) {
            context += `      <extracted_text>${screenshot.aiAnalysis.extractedText.slice(0, 200)}</extracted_text>\n`;
          }
          context += `    </analysis>\n`;
        }
        context += `  </screenshot>\n`;
      });
      context += `</screenshots>\n\n`;

      if (audioSegments.length > 0) {
        context += `<audio_segments count="${audioSegments.length}">\n`;
        audioSegments.forEach((item, index) => {
          const audio = item.data as SessionAudioSegment;
          context += `  <audio index="${index}">\n`;
          context += `    <id>${audio.id}</id>\n`;
          context += `    <start_time>${audio.startTime}</start_time>\n`;
          context += `    <duration>${audio.duration}</duration>\n`;
          if (audio.transcription) {
            context += `    <transcript>${audio.transcription.slice(0, 300)}</transcript>\n`;
          }
          context += `  </audio>\n`;
        });
        context += `</audio_segments>\n\n`;
      }
    } else if (contextLevel === 'timeline') {
      // Timeline: Chronological order with timestamps
      context += `<timeline>\n`;
      recentActivity.forEach((item, index) => {
        if (item.type === 'screenshot') {
          const screenshot = item.data as SessionScreenshot;
          context += `  <event index="${index}" type="screenshot">\n`;
          context += `    <id>${screenshot.id}</id>\n`;
          context += `    <timestamp>${screenshot.timestamp}</timestamp>\n`;
          if (screenshot.aiAnalysis?.detectedActivity) {
            context += `    <activity>${screenshot.aiAnalysis.detectedActivity}</activity>\n`;
          }
          if (screenshot.aiAnalysis?.summary) {
            context += `    <summary>${screenshot.aiAnalysis.summary}</summary>\n`;
          }
          context += `  </event>\n`;
        } else if (item.type === 'audio') {
          const audio = item.data as SessionAudioSegment;
          context += `  <event index="${index}" type="audio">\n`;
          context += `    <id>${audio.id}</id>\n`;
          context += `    <start_time>${audio.startTime}</start_time>\n`;
          if (audio.transcription) {
            context += `    <transcript>${audio.transcription.slice(0, 200)}</transcript>\n`;
          }
          context += `  </event>\n`;
        }
      });
      context += `</timeline>\n\n`;
    }

    context += `</session_context>`;
    return context;
  }

  /**
   * Build system prompt for natural language queries.
   * Instructs Claude on how to answer questions about sessions.
   *
   * @returns System prompt string
   * @private
   */
  private _buildNaturalQuerySystemPrompt(): string {
    return `You are a Session Query Assistant for Taskerino, an AI-powered work session tracker.

Your role is to answer questions about the user's work session based on the provided session context.

SESSION DATA YOU HAVE ACCESS TO:
- Session metadata (name, description, timestamps)
- Progress indicators (achievements, blockers, insights)
- Screenshots with AI analysis (detected activity, summary, extracted text)
- Audio segments with transcripts

INSTRUCTIONS:
1. Answer the user's question directly and concisely
2. Base your answer ONLY on the provided session context
3. If you don't have enough information, say so clearly
4. Reference specific screenshots or audio segments when relevant
5. Include a confidence score (0.0-1.0) based on data quality
6. List source IDs (screenshot/audio IDs) you used to answer

RESPONSE FORMAT:
You must respond in this exact format:

<answer>
[Your concise answer to the question]
</answer>

<confidence>[0.0-1.0]</confidence>

<sources>
[Comma-separated list of screenshot/audio IDs you referenced, or empty if none]
</sources>

EXAMPLE:
Question: "What was I working on around 2pm?"

<answer>
You were debugging an authentication bug in the login flow. Screenshots show error messages related to JWT token validation.
</answer>

<confidence>0.92</confidence>

<sources>
screenshot-abc123, screenshot-def456
</sources>

Now, answer the user's question based on the session context provided.`;
  }

  /**
   * Parse natural language query response from Claude.
   * Extracts answer, confidence, and sources from XML-formatted response.
   *
   * @param responseText - Raw response from Claude
   * @returns Parsed result with answer, confidence, and sources
   * @private
   */
  private _parseNaturalQueryResponse(responseText: string): {
    answer: string;
    confidence: number;
    sources: string[];
  } {
    // Extract answer
    const answerMatch = responseText.match(/<answer>([\s\S]*?)<\/answer>/);
    const answer = answerMatch ? answerMatch[1].trim() : responseText;

    // Extract confidence (default to 0.7 if not found)
    const confidenceMatch = responseText.match(/<confidence>([\s\S]*?)<\/confidence>/);
    let confidence = 0.7;
    if (confidenceMatch) {
      const parsed = parseFloat(confidenceMatch[1].trim());
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        confidence = parsed;
      }
    }

    // Extract sources
    const sourcesMatch = responseText.match(/<sources>([\s\S]*?)<\/sources>/);
    let sources: string[] = [];
    if (sourcesMatch && sourcesMatch[1].trim()) {
      sources = sourcesMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    return {
      answer,
      confidence,
      sources,
    };
  }

  /**
   * Execute an aggregation query for statistical analysis.
   *
   * PLACEHOLDER IMPLEMENTATION - To be implemented in Phase 2.
   *
   * PLANNED FEATURES:
   * - Group by activity, hour, or topic
   * - Calculate metrics (duration, screenshot count, blocker count)
   * - Time range filtering
   * - Statistical aggregations (sum, avg, min, max, count)
   *
   * IMPLEMENTATION NOTES:
   * - Will use SessionListContext for session data access
   * - May leverage InvertedIndexManager for efficient grouping
   * - Should support custom aggregation functions
   *
   * @param query - Aggregation query with grouping and metrics
   * @returns Promise resolving to QueryResult with aggregated data
   *
   * @example
   * ```typescript
   * const result = await engine.query({
   *   groupBy: 'activity',
   *   metrics: ['duration', 'screenshot_count'],
   *   timeRange: { start: new Date('2025-11-01'), end: new Date('2025-11-07') }
   * });
   *
   * // Result.data structure:
   * // {
   * //   "coding": { duration: 480, screenshot_count: 120 },
   * //   "meetings": { duration: 120, screenshot_count: 30 }
   * // }
   * ```
   */
  private async aggregationQuery(query: AggregationQuery): Promise<QueryResult> {
    // PLACEHOLDER: Validate query parameters
    if (!['activity', 'hour', 'topic'].includes(query.groupBy)) {
      throw new QueryError(
        `Invalid groupBy: ${query.groupBy}`,
        'groupBy must be activity, hour, or topic',
        'INVALID_GROUP_BY'
      );
    }

    if (!query.metrics || query.metrics.length === 0) {
      throw new QueryError(
        'Metrics array cannot be empty',
        'Please specify at least one metric',
        'EMPTY_METRICS'
      );
    }

    const validMetrics = ['duration', 'screenshot_count', 'blocker_count'];
    for (const metric of query.metrics) {
      if (!validMetrics.includes(metric)) {
        throw new QueryError(
          `Invalid metric: ${metric}`,
          `Metric must be one of: ${validMetrics.join(', ')}`,
          'INVALID_METRIC'
        );
      }
    }

    if (query.timeRange) {
      if (query.timeRange.start >= query.timeRange.end) {
        throw new QueryError(
          'Start date must be before end date',
          'Please provide a valid time range',
          'INVALID_TIME_RANGE'
        );
      }
    }

    // PLACEHOLDER: Return mock result
    // Future implementation will:
    // 1. Access session data from SessionListContext
    // 2. Filter by time range if specified
    // 3. Group sessions by specified dimension
    // 4. Calculate metrics for each group
    // 5. Return aggregated statistics

    return {
      data: {},
      confidence: 1.0,
    };
  }
}

/**
 * Singleton instance of SessionQueryEngine.
 * Import and use this instance throughout the application.
 *
 * @example
 * ```typescript
 * import { sessionQueryEngine } from './services/SessionQueryEngine';
 *
 * const result = await sessionQueryEngine.query({
 *   activity: ['coding'],
 *   hasBlockers: true
 * });
 * ```
 */
export const sessionQueryEngine = new SessionQueryEngine();
