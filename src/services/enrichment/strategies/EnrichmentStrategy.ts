/**
 * Enrichment Strategy Interface
 *
 * Common interface for all enrichment implementations.
 * Supports both callback-based progress updates and streaming patterns.
 *
 * Implementations:
 * - LegacyEnrichmentStrategy: Wraps existing 10-stage hardcoded pipeline
 * - AIAgentEnrichmentStrategy: AI agent with tool use and chain-of-thought
 */

import type { Session } from '../../../types';

// =============================================================================
// CORE TYPES (Preserved from existing system)
// =============================================================================

/**
 * Enrichment stage identifier
 */
export type EnrichmentStage =
  | 'validating'     // Validate session data
  | 'estimating'     // Cost estimation
  | 'locking'        // Acquire enrichment lock
  | 'checkpointing'  // Create recovery checkpoint
  | 'audio'          // Audio review and transcription
  | 'video'          // Video analysis and chaptering
  | 'summary'        // Session summary generation
  | 'canvas'         // AI canvas generation
  | 'complete'       // Success
  | 'error';         // Failure

/**
 * Stage-specific progress
 */
export interface StageProgress {
  status: 'pending' | 'processing' | 'completed' | 'skipped' | 'error';
  progress: number;  // 0-100
  message: string;   // NO COST display message
  startTime?: number;
  endTime?: number;
  error?: string;
}

/**
 * Overall enrichment progress (NO COST UI philosophy)
 */
export interface EnrichmentProgress {
  sessionId: string;
  stage: EnrichmentStage;
  progress: number;  // 0-100 overall
  message: string;   // User-friendly status message (NO COST INFO)
  startTime: number;
  estimatedCompletion?: number;  // Time-based ETA (NO COST)
  stages: {
    audio: StageProgress;
    video: StageProgress;
    summary: StageProgress;
    canvas: StageProgress;
  };
  lastUpdateAt: number;
}

/**
 * Enrichment options configuration
 */
export interface EnrichmentOptions {
  // Audio enrichment
  skipAudio?: boolean;
  forceReTranscribe?: boolean;
  audioModel?: 'whisper-1';

  // Video enrichment
  skipVideo?: boolean;
  maxChapters?: number;
  chapteringModel?: 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';

  // Summary enrichment
  skipSummary?: boolean;
  summaryModel?: 'claude-3-5-sonnet-20241022' | 'gpt-4o';

  // Canvas enrichment
  skipCanvas?: boolean;
  canvasModel?: 'claude-3-5-sonnet-20241022';

  // General options
  priority?: 'high' | 'normal' | 'low';
  maxRetries?: number;
  onProgress?: (progress: EnrichmentProgress) => void;

  // Feature flags
  useIncrementalEnrichment?: boolean;
  useCaching?: boolean;

  // Background media processing (Task 11-15)
  optimizedVideoPath?: string; // Path to pre-processed optimized video/audio file
}

/**
 * Enrichment result structure
 */
export interface EnrichmentResult {
  success: boolean;
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number;  // milliseconds

  // Cost tracking (NO COST principle for UI, but tracked for analytics)
  costs?: {
    audio?: number;
    video?: number;
    summary?: number;
    canvas?: number;
    total: number;
  };

  // Stage results
  stages: {
    audio: StageResult;
    video: StageResult;
    summary: StageResult;
    canvas: StageResult;
  };

  // Error handling
  error?: {
    stage: EnrichmentStage;
    message: string;
    code?: string;
    recoverable: boolean;
  };

  // Metadata
  enrichmentVersion?: string;
  strategyUsed: 'ai-agent'; // Legacy removed
}

/**
 * Individual stage result
 */
export interface StageResult {
  success: boolean;
  skipped: boolean;
  duration?: number;  // milliseconds
  cost?: number;
  error?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// STRATEGY INTERFACE
// =============================================================================

/**
 * Enrichment Strategy Interface
 *
 * All enrichment implementations must implement this interface.
 * Supports both callback-based progress updates (legacy) and
 * async iteration for streaming updates (AI agent).
 *
 * @example Legacy callback pattern
 * ```typescript
 * const result = await strategy.enrichSession(session, {
 *   onProgress: (progress) => {
 *     console.log(`${progress.stage}: ${progress.progress}%`);
 *   }
 * });
 * ```
 *
 * @example Streaming pattern (AI agent)
 * ```typescript
 * for await (const progress of strategy.enrichSessionStreaming(session, options)) {
 *   console.log(`${progress.stage}: ${progress.message}`);
 * }
 * ```
 */
export interface EnrichmentStrategy {
  /**
   * Strategy identifier
   */
  readonly name: 'ai-agent';

  /**
   * Strategy version for tracking
   */
  readonly version: string;

  /**
   * Enrich a session using callback-based progress updates
   *
   * @param session - Session to enrich
   * @param options - Enrichment configuration
   * @returns Promise resolving to enrichment result
   *
   * @throws {Error} If session is invalid
   * @throws {Error} If enrichment lock cannot be acquired
   * @throws {Error} If critical stage fails
   */
  enrichSession(
    session: Session,
    options?: EnrichmentOptions
  ): Promise<EnrichmentResult>;

  /**
   * Enrich a session with streaming progress updates
   *
   * Yields progress updates as they occur, allowing real-time UI updates.
   * Final yield contains the complete EnrichmentResult.
   *
   * @param session - Session to enrich
   * @param options - Enrichment configuration (onProgress callback ignored)
   * @returns Async iterator yielding progress updates and final result
   *
   * @example
   * ```typescript
   * for await (const update of strategy.enrichSessionStreaming(session, options)) {
   *   if ('success' in update) {
   *     // Final result
   *     console.log('Enrichment complete:', update.success);
   *   } else {
   *     // Progress update
   *     console.log(`Progress: ${update.progress}%`);
   *   }
   * }
   * ```
   */
  enrichSessionStreaming(
    session: Session,
    options?: Omit<EnrichmentOptions, 'onProgress'>
  ): AsyncGenerator<EnrichmentProgress | EnrichmentResult, void, unknown>;

  /**
   * Estimate enrichment cost before execution
   *
   * @param session - Session to estimate
   * @param options - Enrichment configuration
   * @returns Estimated cost in USD
   */
  estimateCost(
    session: Session,
    options?: EnrichmentOptions
  ): Promise<number>;

  /**
   * Validate session is ready for enrichment
   *
   * @param session - Session to validate
   * @returns Validation result with any errors
   */
  validateSession(session: Session): Promise<{
    valid: boolean;
    errors: string[];
    warnings?: string[];
  }>;

  /**
   * Cancel ongoing enrichment
   *
   * @param sessionId - Session ID to cancel
   * @returns True if cancellation successful
   */
  cancelEnrichment(sessionId: string): Promise<boolean>;

  /**
   * Check if strategy supports a specific feature
   *
   * @param feature - Feature to check
   * @returns True if supported
   */
  supportsFeature(feature: EnrichmentFeature): boolean;
}

/**
 * Enrichment features that strategies may or may not support
 */
export type EnrichmentFeature =
  | 'streaming'              // Real-time streaming updates
  | 'incremental'            // Incremental enrichment (delta detection)
  | 'caching'                // Result caching
  | 'cost_estimation'        // Accurate cost estimation
  | 'checkpoint_recovery'    // Recovery from checkpoints
  | 'priority_scheduling'    // Priority-based scheduling
  | 'parallel_stages'        // Parallel stage execution
  | 'custom_models'          // Custom model selection
  | 'tool_use'               // AI tool use (chain-of-thought)
  | 'self_healing';          // Automatic error recovery

// =============================================================================
// STRATEGY FACTORY
// =============================================================================

/**
 * Strategy configuration
 */
export interface StrategyConfig {
  strategy: 'ai-agent'; // Legacy removed

  // Legacy strategy config removed - only AI Agent supported

  // AI agent strategy config
  aiAgent?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableToolUse?: boolean;
    enableStreaming?: boolean;
  };
}

/**
 * Create an enrichment strategy based on configuration
 *
 * @param config - Strategy configuration
 * @returns Configured enrichment strategy
 *
 * @example
 * ```typescript
 * const strategy = createEnrichmentStrategy({
 *   strategy: 'ai-agent',
 *   aiAgent: {
 *     model: 'claude-3-5-sonnet-20241022',
 *     enableStreaming: true
 *   }
 * });
 * ```
 */
export function createEnrichmentStrategy(
  config: StrategyConfig
): EnrichmentStrategy {
  // Implementation will be in EnrichmentOrchestrator.ts
  throw new Error('Use EnrichmentOrchestrator.createStrategy() instead');
}
