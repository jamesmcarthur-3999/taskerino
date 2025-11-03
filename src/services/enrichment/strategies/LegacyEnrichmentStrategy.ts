/**
 * Legacy Enrichment Strategy
 *
 * Wrapper around the existing sessionEnrichmentService.
 * Preserves all existing behavior while implementing the EnrichmentStrategy interface.
 *
 * This strategy wraps the 10-stage hardcoded enrichment pipeline:
 * 1. Validating
 * 2. Estimating
 * 3. Locking
 * 4. Checkpointing
 * 5. Audio (GPT-4o audio review)
 * 6. Video (Claude vision chaptering)
 * 7. Summary (Session summary generation)
 * 8. Canvas (AI canvas generation)
 * 9. Complete
 * 10. Error (if any stage fails)
 */

import type { Session } from '../../../types';
import type {
  EnrichmentStrategy,
  EnrichmentOptions,
  EnrichmentResult,
  EnrichmentProgress,
  EnrichmentFeature,
  StageResult
} from './EnrichmentStrategy';
import { sessionEnrichmentService } from '../../sessionEnrichmentService';
import type { EnrichmentOptions as LegacyEnrichmentOptions } from '../../sessionEnrichmentService';

// =============================================================================
// LEGACY STRATEGY CONFIG
// =============================================================================

export interface LegacyStrategyConfig {
  enableIncremental?: boolean;
  enableCaching?: boolean;
}

// =============================================================================
// LEGACY ENRICHMENT STRATEGY
// =============================================================================

/**
 * Legacy Enrichment Strategy
 *
 * Wraps the existing sessionEnrichmentService with zero changes to logic.
 * All existing behavior is preserved - this is purely an adapter.
 */
export class LegacyEnrichmentStrategy implements EnrichmentStrategy {
  readonly name = 'legacy' as const;
  readonly version = '1.0.0';

  private config: LegacyStrategyConfig;
  private activeCancellations = new Set<string>();

  constructor(config?: LegacyStrategyConfig) {
    this.config = {
      enableIncremental: config?.enableIncremental ?? true,
      enableCaching: config?.enableCaching ?? true
    };
  }

  // ===========================================================================
  // CORE ENRICHMENT
  // ===========================================================================

  /**
   * Enrich session using existing sessionEnrichmentService
   */
  async enrichSession(
    session: Session,
    options?: EnrichmentOptions
  ): Promise<EnrichmentResult> {
    const startTime = Date.now();

    // Convert new options format to legacy format
    const legacyOptions = this.convertToLegacyOptions(options);

    try {
      // Call existing enrichment service (NO CHANGES)
      const result = await sessionEnrichmentService.enrichSession(
        session,
        legacyOptions
      );

      const endTime = Date.now();

      // Convert legacy result to new format
      return {
        success: result.success,
        sessionId: session.id,
        startTime,
        endTime,
        duration: endTime - startTime,
        costs: result.costs ? {
          audio: result.costs.audioReview,
          video: result.costs.videoChaptering,
          summary: result.costs.summary,
          canvas: result.costs.canvas,
          total: result.costs.total
        } : undefined,
        stages: {
          audio: this.convertLegacyStage(result.audioReview),
          video: this.convertLegacyStage(result.videoChaptering),
          summary: this.convertLegacyStage(result.summary),
          canvas: this.convertLegacyStage(result.canvas)
        },
        error: result.error ? {
          stage: this.mapLegacyStage(result.error.stage),
          message: result.error.message,
          recoverable: result.error.recoverable ?? true
        } : undefined,
        enrichmentVersion: '1.0.0',
        strategyUsed: 'legacy'
      };

    } catch (error: any) {
      const endTime = Date.now();

      return {
        success: false,
        sessionId: session.id,
        startTime,
        endTime,
        duration: endTime - startTime,
        stages: {
          audio: { success: false, skipped: false, error: error.message },
          video: { success: false, skipped: false, error: error.message },
          summary: { success: false, skipped: false, error: error.message },
          canvas: { success: false, skipped: false, error: error.message }
        },
        error: {
          stage: 'error',
          message: error.message || 'Enrichment failed',
          recoverable: true
        },
        enrichmentVersion: '1.0.0',
        strategyUsed: 'legacy'
      };
    }
  }

  /**
   * Enrich session with streaming progress updates
   *
   * Legacy strategy doesn't truly stream, but we can wrap the callback
   * pattern to provide async generator interface.
   */
  async* enrichSessionStreaming(
    session: Session,
    options?: Omit<EnrichmentOptions, 'onProgress'>
  ): AsyncGenerator<EnrichmentProgress | EnrichmentResult, void, unknown> {
    // Create promise + resolver for collecting progress updates
    const progressUpdates: EnrichmentProgress[] = [];
    let resolveResult: ((result: EnrichmentResult) => void) | null = null;
    const resultPromise = new Promise<EnrichmentResult>((resolve) => {
      resolveResult = resolve;
    });

    // Convert to callback-based options
    const optionsWithCallback: EnrichmentOptions = {
      ...options,
      onProgress: (progress) => {
        // Convert legacy progress to new format
        const convertedProgress: EnrichmentProgress = {
          sessionId: session.id,
          stage: this.mapLegacyStage(progress.stage),
          progress: progress.progress,
          message: progress.message,
          startTime: progress.startTime,
          estimatedCompletion: progress.estimatedCompletion,
          stages: {
            audio: progress.stages.audio,
            video: progress.stages.video,
            summary: progress.stages.summary,
            canvas: progress.stages.canvas
          },
          lastUpdateAt: progress.lastUpdateAt
        };
        progressUpdates.push(convertedProgress);
      }
    };

    // Start enrichment in background
    this.enrichSession(session, optionsWithCallback).then(resolveResult!);

    // Yield progress updates as they arrive (polling approach)
    let lastYieldedIndex = 0;
    while (true) {
      // Check for new progress updates
      while (lastYieldedIndex < progressUpdates.length) {
        yield progressUpdates[lastYieldedIndex];
        lastYieldedIndex++;
      }

      // Check if enrichment completed
      const settled = await Promise.race([
        resultPromise.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 100))
      ]);

      if (settled) {
        const result = await resultPromise;
        yield result;
        return;
      }
    }
  }

  // ===========================================================================
  // VALIDATION & ESTIMATION
  // ===========================================================================

  /**
   * Estimate enrichment cost
   */
  async estimateCost(
    session: Session,
    options?: EnrichmentOptions
  ): Promise<number> {
    const legacyOptions = this.convertToLegacyOptions(options);
    return sessionEnrichmentService.estimateCost(session, legacyOptions);
  }

  /**
   * Validate session is ready for enrichment
   */
  async validateSession(session: Session): Promise<{
    valid: boolean;
    errors: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if session has enrichable data
    const hasAudio = session.audioSegments && session.audioSegments.length > 0;
    const hasVideo = session.video?.fullVideoAttachmentId;
    const hasScreenshots = session.screenshots && session.screenshots.length > 0;

    if (!hasAudio && !hasVideo && !hasScreenshots) {
      errors.push('Session has no audio, video, or screenshots to enrich');
    }

    // Check if already enriched
    if (session.enrichmentStatus?.status === 'completed') {
      warnings.push('Session already enriched (use forceRegenerate to override)');
    }

    // Check if currently being enriched
    if (session.enrichmentStatus?.status === 'processing') {
      errors.push('Session is currently being enriched');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // ===========================================================================
  // CANCELLATION
  // ===========================================================================

  /**
   * Cancel ongoing enrichment
   *
   * Note: Legacy strategy doesn't support true cancellation,
   * but we track the request for future implementations.
   */
  async cancelEnrichment(sessionId: string): Promise<boolean> {
    this.activeCancellations.add(sessionId);

    // Legacy service doesn't support cancellation yet
    // This is a placeholder for future implementation
    console.warn(`Cancellation requested for ${sessionId}, but legacy strategy doesn't support it yet`);

    return false; // Indicate cancellation not supported
  }

  // ===========================================================================
  // FEATURE SUPPORT
  // ===========================================================================

  /**
   * Check if strategy supports a specific feature
   */
  supportsFeature(feature: EnrichmentFeature): boolean {
    const supportedFeatures: EnrichmentFeature[] = [
      'incremental',
      'caching',
      'cost_estimation',
      'checkpoint_recovery',
      'priority_scheduling',
      'parallel_stages'
    ];

    return supportedFeatures.includes(feature);
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Convert new EnrichmentOptions to legacy format
   */
  private convertToLegacyOptions(
    options?: EnrichmentOptions
  ): LegacyEnrichmentOptions {
    return {
      includeAudio: options?.skipAudio ? false : true,
      includeVideo: options?.skipVideo ? false : true,
      includeSummary: options?.skipSummary ? false : true,
      includeCanvas: options?.skipCanvas ? false : true,
      forceRegenerate: options?.forceReTranscribe ?? false,
      maxCost: options?.maxRetries, // Note: maxRetries maps to maxCost threshold
      onProgress: options?.onProgress
    } as LegacyEnrichmentOptions;
  }

  /**
   * Convert legacy stage result to new format
   */
  private convertLegacyStage(legacyStage?: any): StageResult {
    if (!legacyStage) {
      return {
        success: false,
        skipped: true
      };
    }

    return {
      success: legacyStage.success ?? false,
      skipped: legacyStage.skipped ?? false,
      duration: legacyStage.duration,
      cost: legacyStage.cost,
      error: legacyStage.error,
      metadata: legacyStage.metadata
    };
  }

  /**
   * Map legacy stage names to new format
   */
  private mapLegacyStage(legacyStage?: string): any {
    const stageMap: Record<string, string> = {
      'validating': 'validating',
      'estimating': 'estimating',
      'locking': 'locking',
      'checkpointing': 'checkpointing',
      'audio': 'audio',
      'video': 'video',
      'summary': 'summary',
      'canvas': 'canvas',
      'complete': 'complete',
      'error': 'error'
    };

    return stageMap[legacyStage || 'error'] || 'error';
  }
}
