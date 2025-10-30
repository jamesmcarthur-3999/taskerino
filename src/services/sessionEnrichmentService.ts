/**
 * Session Enrichment Service
 *
 * Production-grade orchestrator for comprehensive post-session enrichment pipeline.
 * Coordinates parallel audio + video enrichment with checkpointing, cost management,
 * and error recovery.
 *
 * Key Features:
 * - Parallel audio/video processing with error isolation
 * - Checkpoint system for recovery from failures
 * - Cost estimation and enforcement of spending caps
 * - Lock acquisition to prevent concurrent enrichment
 * - Progress tracking with real-time updates
 * - Retry logic with exponential backoff
 * - Comprehensive logging and error handling
 * - Graceful partial failure handling
 *
 * Architecture:
 * 1. Validate session has enrichable data (audio/video)
 * 2. Estimate costs and check against threshold
 * 3. Acquire enrichment lock (prevent concurrent processing)
 * 4. Create checkpoint for recovery
 * 5. Execute audio + video enrichment in parallel (Promise.allSettled)
 * 6. Handle partial failures gracefully
 * 7. Regenerate session summary with enriched data
 * 8. Update session with results
 * 9. Clean up checkpoint
 * 10. Release lock
 *
 * Usage:
 * ```typescript
 * const result = await sessionEnrichmentService.enrichSession(session, {
 *   includeAudio: true,
 *   includeVideo: true,
 *   includeSummary: true,
 *   maxCost: 5.0,
 *   onProgress: (progress) => console.log(progress)
 * });
 * ```
 */

import type {
  Session,
  SessionScreenshot,
  SessionAudioSegment,
  AudioInsights,
  VideoChapter,
  Task,
  Note,
  RelatedContextSection,
} from '../types';
import { isFlexibleSummary } from '../types';
import { audioReviewService } from './audioReviewService';
import { videoChapteringService } from './videoChapteringService';
import { sessionsAgentService } from './sessionsAgentService';
import { getCheckpointService, type EnrichmentCheckpoint } from './checkpointService';
import { getEnrichmentLockService } from './enrichmentLockService';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import { getStorage } from './storage';
import { getChunkedStorage, type SessionMetadata } from './storage/ChunkedSessionStorage';
import { generateId } from '../utils/helpers';
import { generateFlexibleSummary } from '../utils/sessionSynthesis';
import { invoke } from '@tauri-apps/api/core';
import { aiCanvasGenerator } from './aiCanvasGenerator';
import { getEnrichmentResultCache } from './enrichment/EnrichmentResultCache';
import type { EnrichmentResultCache } from './enrichment/EnrichmentResultCache';
import { getIncrementalEnrichmentService } from './enrichment/IncrementalEnrichmentService';
import type { IncrementalEnrichmentService } from './enrichment/IncrementalEnrichmentService';
import { getEnrichmentErrorHandler } from './enrichment/EnrichmentErrorHandler';
import type { EnrichmentErrorHandler } from './enrichment/EnrichmentErrorHandler';
import { getProgressTrackingService } from './enrichment/ProgressTrackingService';
import type { ProgressTrackingService } from './enrichment/ProgressTrackingService';
import { adaptiveModelSelector } from './optimization/AdaptiveModelSelector';
import type { ModelSelectionContext } from './optimization/AdaptiveModelSelector';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EnrichmentOptions {
  /** Whether to include audio review (GPT-4o audio analysis) */
  includeAudio?: boolean;

  /** Whether to include video chapter generation */
  includeVideo?: boolean;

  /** Whether to regenerate session summary after enrichment */
  includeSummary?: boolean;

  /** Whether to generate canvas after summary (requires includeSummary: true) */
  includeCanvas?: boolean;

  /** Force regeneration even if already completed */
  forceRegenerate?: boolean;

  /** Maximum total cost threshold in USD */
  maxCost?: number;

  /** Resume from existing checkpoint if available */
  resumeFromCheckpoint?: boolean;

  /** Optimized video path from background media processing */
  optimizedVideoPath?: string;

  /** Progress callback for real-time updates */
  onProgress?: (progress: EnrichmentProgress) => void;
}

export interface EnrichmentProgress {
  /** Current stage being processed */
  stage: 'validating' | 'estimating' | 'locking' | 'checkpointing' | 'audio' | 'video' | 'summary' | 'canvas' | 'complete' | 'error';

  /** Human-readable progress message */
  message: string;

  /** Overall progress percentage (0-100) */
  progress: number;

  /** Detailed stage progress */
  stages?: {
    audio?: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'; progress: number };
    video?: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'; progress: number };
    summary?: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'; progress: number };
    canvas?: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'; progress: number };
  };
}

export interface EnrichmentResult {
  /** Whether enrichment completed successfully (at least partially) */
  success: boolean;

  /** Audio enrichment results */
  audio?: {
    completed: boolean;
    fullTranscription?: string;
    fullAudioAttachmentId?: string;
    insights?: AudioInsights;
    upgradedSegments?: SessionAudioSegment[];
    cost: number;
    duration: number;
    error?: string;
  };

  /** Video enrichment results */
  video?: {
    completed: boolean;
    chapters?: VideoChapter[];
    cost: number;
    duration: number;
    error?: string;
  };

  /** Summary regeneration results */
  summary?: {
    completed: boolean;
    summary?: any;
    duration: number;
    error?: string;
  };

  /** Canvas generation results */
  canvas?: {
    completed: boolean;
    canvasSpec?: any;
    duration: number;
    error?: string;
  };

  /** Total cost across all stages in USD */
  totalCost: number;

  /** Total duration in seconds */
  totalDuration: number;

  /** Non-critical warnings */
  warnings: string[];
}

export interface CostEstimate {
  /** Estimated audio review cost in USD */
  audio: number;

  /** Estimated video chapter cost in USD */
  video: number;

  /** Estimated summary regeneration cost in USD */
  summary: number;

  /** Total estimated cost in USD */
  total: number;

  /** Whether estimate exceeds max cost threshold */
  exceedsThreshold: boolean;

  /** Breakdown of cost components */
  breakdown: {
    audio?: { duration: number; ratePerMinute: number; estimatedCost: number };
    video?: { frameCount: number; ratePerFrame: number; estimatedCost: number };
    summary?: { tokens: number; ratePerToken: number; estimatedCost: number };
  };
}

export interface EnrichmentCapability {
  /** Whether session has audio data to enrich */
  audio: boolean;

  /** Whether session has video data to enrich */
  video: boolean;

  /** Reasons why enrichment may not be possible */
  reasons: {
    audio?: string[];
    video?: string[];
  };
}

// ============================================================================
// Session Enrichment Service
// ============================================================================

export class SessionEnrichmentService {
  private readonly checkpointService = getCheckpointService();
  private readonly lockService = getEnrichmentLockService();
  private readonly cache: EnrichmentResultCache;
  private readonly incrementalService: IncrementalEnrichmentService;
  private readonly errorHandler: EnrichmentErrorHandler;
  private readonly progressService: ProgressTrackingService;

  // Cost estimation constants (as of 2025)
  private readonly COST_PER_AUDIO_MINUTE = 0.026; // GPT-4o audio preview
  private readonly COST_PER_TRANSCRIPT_UPGRADE = 0.002; // Whisper + Haiku batch merge per minute (~$0.0006 Whisper + ~$0.0014 Haiku)
  private readonly COST_PER_VIDEO_FRAME = 0.001; // Claude vision API (rough estimate)
  private readonly COST_PER_SUMMARY_TOKEN = 0.000003; // Claude Sonnet 3.5 output tokens
  private readonly ESTIMATED_SUMMARY_TOKENS = 1000; // Estimated tokens for summary

  // Default settings
  private readonly DEFAULT_MAX_COST = 10.0; // $10 USD
  private readonly DEFAULT_LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.cache = getEnrichmentResultCache();
    this.incrementalService = getIncrementalEnrichmentService();
    this.errorHandler = getEnrichmentErrorHandler();
    this.progressService = getProgressTrackingService();
  }

  /**
   * Select optimal models for enrichment tasks using AdaptiveModelSelector
   *
   * This ensures:
   * - Screenshot analysis uses Haiku 4.5 (real-time, $1/MTok) - 67% cost savings
   * - Video chaptering uses appropriate model based on complexity
   * - Session summaries use Sonnet 4.5 (comprehensive, $3/MTok)
   *
   * @returns Selected models for each enrichment stage
   */
  private selectEnrichmentModels(): {
    screenshotModel: string;
    videoModel: string;
    summaryModel: string;
  } {
    // Screenshot analysis - real-time, low complexity
    const screenshotContext: ModelSelectionContext = {
      taskType: 'screenshot_analysis_realtime',
      realtime: true,
      stakes: 'low',
      estimatedInputTokens: 500,
      expectedOutputTokens: 200,
    };
    const screenshotResult = adaptiveModelSelector.selectModel(screenshotContext);

    // Video chaptering - batch processing, moderate complexity
    const videoContext: ModelSelectionContext = {
      taskType: 'video_chaptering',
      realtime: false,
      stakes: 'medium',
      estimatedInputTokens: 2000,
      expectedOutputTokens: 1000,
    };
    const videoResult = adaptiveModelSelector.selectModel(videoContext);

    // Session summary - batch processing, high complexity
    const summaryContext: ModelSelectionContext = {
      taskType: 'summarization',
      realtime: false,
      stakes: 'high',
      estimatedInputTokens: 5000,
      expectedOutputTokens: 1500,
    };
    const summaryResult = adaptiveModelSelector.selectModel(summaryContext);

    // Log model selections (backend only, not user-facing)
    console.log('[MODEL SELECTION] Enrichment models selected:', {
      screenshot: {
        model: screenshotResult.model,
        reason: screenshotResult.config.reason,
        estimatedCost: screenshotResult.estimatedCost,
      },
      video: {
        model: videoResult.model,
        reason: videoResult.config.reason,
        estimatedCost: videoResult.estimatedCost,
      },
      summary: {
        model: summaryResult.model,
        reason: summaryResult.config.reason,
        estimatedCost: summaryResult.estimatedCost,
      },
    });

    return {
      screenshotModel: screenshotResult.model,
      videoModel: videoResult.model,
      summaryModel: summaryResult.model,
    };
  }

  /**
   * Enrich a session with comprehensive audio/video analysis
   *
   * @param session - Session to enrich
   * @param options - Enrichment options
   * @returns Enrichment results
   */
  async enrichSession(
    session: Session,
    options: EnrichmentOptions = {}
  ): Promise<EnrichmentResult> {
    const startTime = Date.now();
    const logger = this.createLogger(session.id);

    logger.info('Starting session enrichment', {
      sessionId: session.id,
      sessionName: session.name,
      options,
    });

    // DEBUG: Log audioSegments structure to diagnose missing attachmentIds
    if (session.audioSegments && session.audioSegments.length > 0) {
      logger.info('🔍 [DEBUG] AudioSegments inspection:', {
        count: session.audioSegments.length,
        firstSegment: {
          id: session.audioSegments[0].id,
          duration: session.audioSegments[0].duration,
          hasAttachmentId: !!session.audioSegments[0].attachmentId,
          attachmentId: session.audioSegments[0].attachmentId || 'MISSING',
          hasHash: !!session.audioSegments[0].hash,
          hash: session.audioSegments[0].hash?.substring(0, 16) || 'MISSING',
          hasTranscription: !!session.audioSegments[0].transcription,
          keys: Object.keys(session.audioSegments[0]),
        },
        allSegments: session.audioSegments.map(s => ({
          id: s.id,
          hasAttachmentId: !!s.attachmentId,
          hasHash: !!s.hash,
        })),
      });
    } else {
      logger.warn('⚠️  [DEBUG] No audioSegments in session!', {
        hasAudioSegments: !!session.audioSegments,
        audioSegmentsLength: session.audioSegments?.length || 0,
      });
    }

    // Default options (excluding optional fields like optimizedVideoPath)
    const opts: Required<Omit<EnrichmentOptions, 'optimizedVideoPath'>> & Pick<EnrichmentOptions, 'optimizedVideoPath'> = {
      includeAudio: options.includeAudio ?? true,
      includeVideo: options.includeVideo ?? true,
      includeSummary: options.includeSummary ?? true,
      includeCanvas: options.includeCanvas ?? true,
      forceRegenerate: options.forceRegenerate ?? false,
      maxCost: options.maxCost ?? this.DEFAULT_MAX_COST,
      resumeFromCheckpoint: options.resumeFromCheckpoint ?? true,
      optimizedVideoPath: options.optimizedVideoPath,
      onProgress: options.onProgress ?? (() => {}),
    };

    const result: EnrichmentResult = {
      success: false,
      totalCost: 0,
      totalDuration: 0,
      warnings: [],
    };

    // Start progress tracking (NO COST INFO)
    this.progressService.startProgress(session.id, {
      includeAudio: opts.includeAudio,
      includeVideo: opts.includeVideo,
      includeSummary: opts.includeSummary,
      includeCanvas: opts.includeCanvas,
    });

    try {
      // Stage 0: Cache Lookup (only if not forcing regeneration)
      if (!opts.forceRegenerate) {
        opts.onProgress({
          stage: 'validating',
          message: 'Checking cache...',
          progress: 2,
        });

        // Select optimal models using AdaptiveModelSelector
        const selectedModels = this.selectEnrichmentModels();

        const cacheKey = this.cache.generateCacheKeyFromSession(
          session,
          'enrichment-v1', // Versioned prompt to invalidate on major changes
          {
            audioModel: 'gpt-4o-audio-preview-2024-10-01', // Audio model remains GPT-4o
            videoModel: selectedModels.videoModel,
            summaryModel: selectedModels.summaryModel,
          }
        );

        const cachedResult = await this.cache.getCachedResult(cacheKey);
        if (cachedResult) {
          logger.info('✓ Cache HIT - returning cached enrichment result', {
            cacheKey: cacheKey.slice(0, 8),
            cachedAt: new Date(cachedResult.cachedAt).toISOString(),
            costSavings: cachedResult.totalCost,
          });

          // Update session with cached results
          // Add 'completed: true' to match EnrichmentResult type
          const cachedEnrichmentResult = {
            success: true,
            audio: cachedResult.audio ? { ...cachedResult.audio, completed: true } : undefined,
            video: cachedResult.video ? { ...cachedResult.video, completed: true } : undefined,
            summary: cachedResult.summary ? { ...cachedResult.summary, completed: true } : undefined,
            canvas: cachedResult.canvas ? { ...cachedResult.canvas, completed: true } : undefined,
            totalCost: 0, // No actual cost incurred
            totalDuration: (Date.now() - startTime) / 1000,
            warnings: ['Result retrieved from cache (no processing cost)'],
          };

          await this.updateSessionWithResults(session, cachedEnrichmentResult);

          opts.onProgress({
            stage: 'complete',
            message: 'Enrichment complete (cached)!',
            progress: 100,
          });

          return cachedEnrichmentResult;
        }

        logger.info('✗ Cache MISS - proceeding with full enrichment', {
          cacheKey: cacheKey.slice(0, 8),
        });
      } else {
        logger.info('⚠ Force regenerate enabled - skipping cache lookup');
      }

      // Stage 0.5: Check for Incremental Enrichment (only if not forcing regeneration)
      let useIncremental = false;
      let incrementalDelta: any = null;
      let incrementalSession: Session = session;

      if (!opts.forceRegenerate) {
        opts.onProgress({
          stage: 'validating',
          message: 'Checking for incremental enrichment...',
          progress: 3,
        });

        const checkpoint = await this.incrementalService.getCheckpoint(session.id);
        if (checkpoint) {
          logger.info('✓ Checkpoint found - checking if incremental enrichment is possible');

          const delta = await this.incrementalService.detectDelta(session, checkpoint);

          if (!delta.requiresFullRegeneration && (delta.newScreenshots.length > 0 || delta.newAudioSegments.length > 0)) {
            // Incremental enrichment is possible!
            const estimatedSavings = this.incrementalService.estimateCostSavings(session, delta);

            logger.info('✓ Incremental enrichment enabled - processing only new data', {
              newScreenshots: delta.newScreenshots.length,
              newAudioSegments: delta.newAudioSegments.length,
              estimatedSavings: estimatedSavings.toFixed(4),
            });

            opts.onProgress({
              stage: 'validating',
              message: `Processing ${delta.newScreenshots.length} new screenshots and ${delta.newAudioSegments.length} new audio segments...`,
              progress: 5,
            });

            // Enable incremental mode
            useIncremental = true;
            incrementalDelta = delta;

            // Create incremental session snapshot (contains only new data)
            incrementalSession = {
              ...session,
              screenshots: delta.newScreenshots,
              audioSegments: delta.newAudioSegments,
            };

            result.warnings.push(
              `Incremental enrichment: Processing ${delta.newScreenshots.length} new screenshots, ${delta.newAudioSegments.length} new audio segments. Estimated savings: $${estimatedSavings.toFixed(2)}`
            );
          } else {
            logger.info('⚠ Full regeneration required', {
              reasons: delta.fullRegenerationReasons,
            });
            result.warnings.push(...delta.fullRegenerationReasons.map(r => `Full regeneration: ${r}`));
          }
        } else {
          logger.info('✗ No checkpoint found - first enrichment or checkpoint cleared');
        }
      }

      // Stage 1: Validation
      opts.onProgress({
        stage: 'validating',
        message: 'Validating session data...',
        progress: 5,
      });

      // Validate using incrementalSession (which may contain only new data)
      const capability = await this.canEnrich(incrementalSession);
      logger.info('Session enrichment capability', capability);

      // Adjust options based on capability
      if (!capability.audio) {
        opts.includeAudio = false;
        if (capability.reasons.audio) {
          result.warnings.push(...capability.reasons.audio);
        }
      }
      if (!capability.video) {
        opts.includeVideo = false;
        if (capability.reasons.video) {
          result.warnings.push(...capability.reasons.video);
        }
      }

      // Check if already enriched (unless force regenerate OR incremental mode)
      if (!opts.forceRegenerate && !useIncremental) {
        if (session.audioReviewCompleted && opts.includeAudio) {
          opts.includeAudio = false;
          result.warnings.push('Audio review already completed. Use forceRegenerate to re-run.');
        }
        if (session.video?.chapters && session.video.chapters.length > 0 && opts.includeVideo) {
          opts.includeVideo = false;
          result.warnings.push('Video chapters already generated. Use forceRegenerate to re-run.');
        }
      }

      // If nothing to do, return early
      if (!opts.includeAudio && !opts.includeVideo && !opts.includeSummary) {
        logger.info('No enrichment needed');
        return {
          success: true,
          totalCost: 0,
          totalDuration: (Date.now() - startTime) / 1000,
          warnings: result.warnings,
        };
      }

      // Stage 2: Cost Estimation
      opts.onProgress({
        stage: 'estimating',
        message: 'Estimating costs...',
        progress: 10,
      });

      const costEstimate = await this.estimateCost(session, opts);
      logger.info('Cost estimate', costEstimate);

      if (costEstimate.exceedsThreshold) {
        throw new Error(
          `Estimated cost ($${costEstimate.total.toFixed(1)}) exceeds maximum threshold ($${opts.maxCost.toFixed(1)})`
        );
      }

      // Stage 3: Lock Acquisition
      opts.onProgress({
        stage: 'locking',
        message: 'Acquiring enrichment lock...',
        progress: 15,
      });

      const lockAcquired = await this.lockService.acquireLock(
        session.id,
        this.DEFAULT_LOCK_TIMEOUT
      );

      if (!lockAcquired) {
        throw new Error('Failed to acquire enrichment lock. Another enrichment may be in progress.');
      }

      logger.info('Lock acquired successfully');

      try {
        // Stage 4: Checkpoint Creation
        opts.onProgress({
          stage: 'checkpointing',
          message: 'Creating recovery checkpoint...',
          progress: 20,
        });

        const checkpoint = await this.checkpointService.createCheckpoint(session.id, {
          stage: 'audio',
          progress: 20,
          partialResults: {},
        });

        logger.info('Checkpoint created', { checkpointId: checkpoint.id });

        // Stage 4.5: Initialize enrichment status to 'in-progress'
        opts.onProgress({
          stage: 'checkpointing',
          message: 'Starting enrichment...',
          progress: 25,
        });

        // Update session in storage with 'in-progress' status
        try {
          const chunkedStorage = await getChunkedStorage();

          try {
            // Load current session (Phase 4: use ChunkedStorage with cache-first)
            // Try cache first for freshest data (optimistic updates from ActiveSessionContext)
            let currentSession = chunkedStorage.getCachedSession(session.id);

            // Fallback to storage if not in cache
            if (!currentSession) {
              console.log(`[ENRICHMENT] Cache miss for session ${session.id}, loading from storage...`);
              currentSession = await chunkedStorage.loadFullSession(session.id);
            } else {
              console.log(`[ENRICHMENT] Cache hit for session ${session.id} - using optimistic data`);
            }

            if (!currentSession) {
              throw new Error(`Session ${session.id} not found`);
            }

            const expectedVersion = currentSession.version || 0;

            // Update enrichment status
            const updatedSession: Session = {
              ...currentSession,
              enrichmentStatus: {
                status: 'in-progress' as const,
                progress: 25,
                currentStage: 'audio' as const,
                audio: { status: opts.includeAudio ? 'pending' as const : 'skipped' as const },
                video: { status: opts.includeVideo ? 'pending' as const : 'skipped' as const },
                summary: { status: opts.includeSummary ? 'pending' as const : 'skipped' as const },
                totalCost: 0,
                errors: [],
                warnings: result.warnings,
                canResume: true,
              },
              version: expectedVersion + 1,
            };

            // Save session (Phase 4: ChunkedStorage)
            await chunkedStorage.saveFullSession(updatedSession);

            logger.info(`[Enrichment] ✓ Set in-progress status (version ${expectedVersion} → ${expectedVersion + 1})`);
          } catch (error) {
            throw error;
          }
        } catch (error: any) {
          logger.warn('Failed to set enrichment status to in-progress', error);
          // Don't throw - this is non-critical for enrichment to proceed
        }

        try {
          // Stage 5: Parallel Enrichment
          const enrichmentPromises: Array<Promise<any>> = [];

          // Audio enrichment (use incrementalSession for incremental mode)
          if (opts.includeAudio) {
            enrichmentPromises.push(
              this.enrichAudio(incrementalSession, checkpoint.id, opts.onProgress)
            );
          } else {
            result.audio = {
              completed: false,
              cost: 0,
              duration: 0,
              // Don't set error field - undefined means skipped
            };
          }

          // Video enrichment (use incrementalSession for incremental mode)
          if (opts.includeVideo) {
            enrichmentPromises.push(
              this.enrichVideo(incrementalSession, checkpoint.id, opts.onProgress)
            );
          } else {
            result.video = {
              completed: false,
              cost: 0,
              duration: 0,
              // Don't set error field - undefined means skipped
            };
          }

          // Execute in parallel with error isolation
          logger.info('🚀 Starting parallel enrichment', {
            includeAudio: opts.includeAudio,
            includeVideo: opts.includeVideo,
            promiseCount: enrichmentPromises.length,
          });

          opts.onProgress({
            stage: 'audio',
            message: 'Processing audio and video in parallel...',
            progress: 30,
          });

          const enrichmentResults = await Promise.allSettled(enrichmentPromises);

          logger.info('📊 Parallel enrichment results', {
            totalPromises: enrichmentResults.length,
            fulfilled: enrichmentResults.filter(r => r.status === 'fulfilled').length,
            rejected: enrichmentResults.filter(r => r.status === 'rejected').length,
          });

          // Process results
          let enrichmentIndex = 0;
          if (opts.includeAudio) {
            const audioResult = enrichmentResults[enrichmentIndex++];
            if (audioResult.status === 'fulfilled') {
              result.audio = audioResult.value;
              result.totalCost += audioResult.value.cost;
              logger.info('✅ Audio result: SUCCESS', {
                cost: audioResult.value.cost,
                duration: audioResult.value.duration,
              });
            } else {
              logger.error('❌ Audio result: FAILED', {
                error: audioResult.reason.message,
                stack: audioResult.reason.stack,
              });
              result.audio = {
                completed: false,
                cost: 0,
                duration: 0,
                error: audioResult.reason.message || 'Unknown error',
              };
            }
          }

          if (opts.includeVideo) {
            const videoResult = enrichmentResults[enrichmentIndex++];
            if (videoResult.status === 'fulfilled') {
              result.video = videoResult.value;
              result.totalCost += videoResult.value.cost;
              logger.info('✅ Video result: SUCCESS', {
                cost: videoResult.value.cost,
                duration: videoResult.value.duration,
                chapterCount: videoResult.value.chapters?.length || 0,
              });
            } else {
              logger.error('❌ Video result: FAILED', {
                error: videoResult.reason.message,
                stack: videoResult.reason.stack,
              });
              result.video = {
                completed: false,
                cost: 0,
                duration: 0,
                error: videoResult.reason.message || 'Unknown error',
              };
            }
          }

          // Stage 6: Summary Regeneration
          if (opts.includeSummary) {
            opts.onProgress({
              stage: 'summary',
              message: 'Regenerating session summary...',
              progress: 80,
            });

            try {
              const summaryResult = await this.enrichSummary(
                session,
                { audio: result.audio, video: result.video },
                opts.onProgress
              );
              result.summary = summaryResult;
            } catch (error: any) {
              logger.error('Summary regeneration failed', error);
              result.summary = {
                completed: false,
                duration: 0,
                error: error.message || 'Unknown error',
              };
            }
          }

          // Stage 6.5: Canvas Generation (independent of summary - can use audio/video insights directly)
          // Canvas can be generated from summary OR audio/video insights
          const canHasEnrichedData =
            (result.audio?.completed && result.audio.insights) ||
            (result.video?.completed && result.video.chapters && result.video.chapters.length > 0);

          if (opts.includeCanvas && canHasEnrichedData) {
            opts.onProgress({
              stage: 'canvas',
              message: 'Generating interactive canvas...',
              progress: 90,
            });

            try {
              const canvasStartTime = Date.now();

              // Get latest session data (Phase 4: use ChunkedStorage)
              const chunkedStorage = await getChunkedStorage();
              const latestSession = await chunkedStorage.loadFullSession(session.id);

              if (!latestSession) {
                // Graceful handling: Session may have been deleted during enrichment
                console.warn(`[Enrichment] Session ${session.id} not found during canvas generation - skipping`);
                logger.warn('Session not found during canvas generation', {
                  sessionId: session.id,
                  stage: 'canvas_generation',
                });
                // Skip canvas generation but don't fail entire enrichment
                result.canvas = {
                  completed: false,
                  error: 'Session not found - may have been deleted during enrichment',
                  duration: 0,
                };
                // Don't generate canvas, but continue with rest of enrichment (fall through to end of try block)
              } else {
                // Build enriched session with available data (summary OR audio/video insights)
                const enrichedSession = {
                  ...latestSession,
                  // Use enriched summary if available, otherwise use existing
                  summary: result.summary?.completed ? result.summary.summary : latestSession.summary,
                  // Always include fresh audio/video insights
                  audioInsights: result.audio?.insights || latestSession.audioInsights,
                  video: latestSession.video ? {
                    ...latestSession.video,
                    chapters: result.video?.chapters || latestSession.video.chapters,
                  } : undefined,
                };

                logger.info('Generating canvas from enriched session data', {
                  hasSummary: !!enrichedSession.summary,
                  hasAudioInsights: !!enrichedSession.audioInsights,
                  hasVideoChapters: !!(enrichedSession.video?.chapters && enrichedSession.video.chapters.length > 0),
                });

                // Generate canvas with progress tracking
                const canvasSpec = await aiCanvasGenerator.generate(enrichedSession, (progress, stage) => {
                  // Map canvas generation progress (90-95%) within the overall enrichment progress
                  const overallProgress = 90 + (progress * 5);
                  opts.onProgress({
                    stage: 'canvas',
                    message: stage || 'Generating interactive canvas...',
                    progress: overallProgress,
                  });
                });

                const canvasDuration = (Date.now() - canvasStartTime) / 1000;

                result.canvas = {
                  completed: true,
                  canvasSpec,
                  duration: canvasDuration,
                };

                logger.info('Canvas generation completed', {
                  duration: canvasDuration,
                  componentCount: canvasSpec.componentTree?.children?.length || 0,
                });
              }
            } catch (error: any) {
              logger.error('Canvas generation failed', error);
              result.canvas = {
                completed: false,
                duration: 0,
                error: error.message || 'Unknown error',
              };
              // Canvas failure is not critical - continue with enrichment
              result.warnings.push(`Canvas generation failed: ${error.message}`);
            }
          } else if (opts.includeCanvas && !canHasEnrichedData) {
            logger.warn('Canvas generation skipped: no enriched audio/video data available');
            result.warnings.push('Canvas generation skipped because no enriched audio or video data is available');
          }

          // Determine overall success BEFORE updating session (FIX: was calculated too late)
          result.success =
            (result.audio?.completed ?? false) ||
            (result.video?.completed ?? false) ||
            (result.summary?.completed ?? false) ||
            (result.canvas?.completed ?? false);

          // Stage 7: Update Session
          await this.updateSessionWithResults(session, result);

          // Stage 8: Cleanup Checkpoint
          await this.checkpointService.deleteCheckpoint(checkpoint.id);
          logger.info('Checkpoint deleted');

          result.totalDuration = (Date.now() - startTime) / 1000;

          // Stage 9: Cache successful result for future use
          if (result.success && !opts.forceRegenerate) {
            try {
              // Select optimal models using AdaptiveModelSelector
              const selectedModels = this.selectEnrichmentModels();

              const cacheKey = this.cache.generateCacheKeyFromSession(
                session,
                'enrichment-v1',
                {
                  audioModel: 'gpt-4o-audio-preview-2024-10-01', // Audio model remains GPT-4o
                  videoModel: selectedModels.videoModel,
                  summaryModel: selectedModels.summaryModel,
                }
              );

              await this.cache.cacheResult(cacheKey, {
                audio: result.audio,
                video: result.video,
                summary: result.summary,
                canvas: result.canvas,
                totalCost: result.totalCost,
                totalDuration: result.totalDuration,
              });

              logger.info('✓ Cached enrichment result for future use', {
                cacheKey: cacheKey.slice(0, 8),
                costCached: result.totalCost,
              });
            } catch (cacheError: any) {
              logger.warn('Failed to cache enrichment result (non-fatal)', cacheError);
              // Don't fail enrichment if caching fails
            }
          }

          // Stage 10: Create/Update Incremental Enrichment Checkpoint
          if (result.success && !opts.forceRegenerate) {
            try {
              const existingCheckpoint = await this.incrementalService.getCheckpoint(session.id);

              if (existingCheckpoint) {
                // Update existing checkpoint
                await this.incrementalService.updateCheckpoint(session.id, {
                  lastScreenshotIndex: session.screenshots.length - 1,
                  lastAudioSegmentIndex: (session.audioSegments?.length ?? 0) - 1,
                  audioHash: session.audioSegments && session.audioSegments.length > 0
                    ? await this.hashAudioData(session.audioSegments)
                    : '',
                  videoHash: session.screenshots.length > 0
                    ? await this.hashVideoData(session.screenshots)
                    : '',
                  additionalCost: result.totalCost,
                  additionalScreenshots: session.screenshots.length - (existingCheckpoint.screenshotsProcessed || 0),
                  additionalAudioSegments: (session.audioSegments?.length ?? 0) - (existingCheckpoint.audioSegmentsProcessed || 0),
                });

                logger.info('✓ Updated incremental enrichment checkpoint', {
                  sessionId: session.id,
                  totalCost: existingCheckpoint.totalCost + result.totalCost,
                });
              } else {
                // Create initial checkpoint
                await this.incrementalService.createCheckpoint(session.id, session, result.totalCost);

                logger.info('✓ Created initial incremental enrichment checkpoint', {
                  sessionId: session.id,
                  totalCost: result.totalCost,
                });
              }
            } catch (checkpointError: any) {
              logger.warn('Failed to create/update incremental enrichment checkpoint (non-fatal)', checkpointError);
              // Don't fail enrichment if checkpoint fails
            }
          }

          opts.onProgress({
            stage: 'complete',
            message: 'Enrichment complete!',
            progress: 100,
          });

          // Update progress tracking (NO COST INFO)
          this.progressService.completeProgress(
            session.id,
            true,
            'Session enrichment complete'
          );

          logger.info('Enrichment completed successfully', {
            totalCost: result.totalCost,
            totalDuration: result.totalDuration,
            audioCompleted: result.audio?.completed,
            videoCompleted: result.video?.completed,
            summaryCompleted: result.summary?.completed,
          });

          return result;
        } catch (error: any) {
          // Update checkpoint with error
          await this.checkpointService.updateCheckpoint(checkpoint.id, {
            canResume: true,
            progress: 50,
          });

          throw error;
        }
      } finally {
        // Always release lock
        await this.lockService.releaseLock(session.id);
        logger.info('Lock released');
      }
    } catch (error: any) {
      logger.error('Enrichment failed', error);

      opts.onProgress({
        stage: 'error',
        message: `Enrichment failed: ${error.message}`,
        progress: 0,
      });

      // Update progress tracking (NO COST INFO)
      this.progressService.completeProgress(
        session.id,
        false,
        error.message || 'Enrichment failed'
      );

      // FIX: Update session enrichmentStatus to 'failed' in storage (Phase 4: ChunkedStorage)
      try {
        const chunkedStorage = await getChunkedStorage();

        try {
          // Load current session (Phase 4: ChunkedStorage with cache-first)
          // Try cache first for freshest data (optimistic updates from ActiveSessionContext)
          let currentSession = chunkedStorage.getCachedSession(session.id);

          // Fallback to storage if not in cache
          if (!currentSession) {
            console.log(`[ENRICHMENT] Cache miss for session ${session.id}, loading from storage...`);
            currentSession = await chunkedStorage.loadFullSession(session.id);
          } else {
            console.log(`[ENRICHMENT] Cache hit for session ${session.id} - using optimistic data`);
          }

          if (!currentSession) {
            throw new Error(`Session ${session.id} not found`);
          }

          const expectedVersion = currentSession.version || 0;

          // Update enrichment status to failed
          const updatedSession: Session = {
            ...currentSession,
            enrichmentStatus: {
              status: 'failed' as const,
              completedAt: new Date().toISOString(),
              progress: 0,
              currentStage: 'complete' as const,
              audio: { status: 'failed' as const, error: error.message },
              video: { status: 'skipped' as const },
              summary: { status: 'skipped' as const },
              totalCost: result.totalCost,
              errors: [error.message],
              warnings: result.warnings,
              canResume: false,
            },
            version: expectedVersion + 1,
          };

          // Save session (Phase 4: ChunkedStorage)
          await chunkedStorage.saveFullSession(updatedSession);

          logger.info(`[Enrichment] ✓ Set failed status (version ${expectedVersion} → ${expectedVersion + 1})`);
        } catch (txError) {
          throw txError;
        }
      } catch (updateError: any) {
        logger.error('Failed to update session with error status', updateError);
      }

      result.success = false;
      result.totalDuration = (Date.now() - startTime) / 1000;
      result.warnings.push(error.message);

      return result;
    }
  }

  /**
   * Estimate the cost of enriching a session
   *
   * @param session - Session to estimate
   * @param options - Enrichment options
   * @returns Cost estimate
   */
  async estimateCost(
    session: Session,
    options: EnrichmentOptions = {}
  ): Promise<CostEstimate> {
    const estimate: CostEstimate = {
      audio: 0,
      video: 0,
      summary: 0,
      total: 0,
      exceedsThreshold: false,
      breakdown: {},
    };

    // Audio cost estimation
    if (options.includeAudio !== false && session.audioSegments && session.audioSegments.length > 0) {
      const audioCost = audioReviewService.getCostEstimate(session);

      // Add transcript upgrade cost (Whisper + Haiku batch merge)
      const totalDuration = session.audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
      const transcriptUpgradeCost = (totalDuration / 60) * this.COST_PER_TRANSCRIPT_UPGRADE;

      estimate.audio = audioCost.cost + transcriptUpgradeCost;
      estimate.breakdown.audio = {
        duration: audioCost.duration,
        ratePerMinute: this.COST_PER_AUDIO_MINUTE,
        estimatedCost: audioCost.cost + transcriptUpgradeCost,
      };
    }

    // Video cost estimation
    if (options.includeVideo !== false && session.video?.fullVideoAttachmentId) {
      const videoDuration = session.video.duration || 0;
      const framesPerMinute = 2; // Sample every 30 seconds
      const estimatedFrames = Math.ceil((videoDuration / 60) * framesPerMinute);
      const videoCost = estimatedFrames * this.COST_PER_VIDEO_FRAME;

      estimate.video = videoCost;
      estimate.breakdown.video = {
        frameCount: estimatedFrames,
        ratePerFrame: this.COST_PER_VIDEO_FRAME,
        estimatedCost: videoCost,
      };
    }

    // Summary cost estimation
    if (options.includeSummary !== false) {
      const summaryCost = this.ESTIMATED_SUMMARY_TOKENS * this.COST_PER_SUMMARY_TOKEN;
      estimate.summary = summaryCost;
      estimate.breakdown.summary = {
        tokens: this.ESTIMATED_SUMMARY_TOKENS,
        ratePerToken: this.COST_PER_SUMMARY_TOKEN,
        estimatedCost: summaryCost,
      };
    }

    estimate.total = estimate.audio + estimate.video + estimate.summary;
    estimate.exceedsThreshold = estimate.total > (options.maxCost ?? this.DEFAULT_MAX_COST);

    return estimate;
  }

  /**
   * Check if a session can be enriched
   *
   * @param session - Session to check
   * @returns Enrichment capability
   */
  async canEnrich(session: Session): Promise<EnrichmentCapability> {
    const logger = this.createLogger(session.id);
    const capability: EnrichmentCapability = {
      audio: false,
      video: false,
      reasons: {},
    };

    // Check audio
    if (!session.audioSegments || session.audioSegments.length === 0) {
      capability.audio = false;
      capability.reasons.audio = ['No audio segments available'];
      logger.info('❌ Audio enrichment not possible: No audio segments available', {
        audioSegments: session.audioSegments,
        audioSegmentCount: session.audioSegments?.length || 0,
      });
    } else {
      const totalDuration = session.audioSegments.reduce((sum, seg) => sum + seg.duration, 0);
      if (totalDuration < 10) {
        capability.audio = false;
        capability.reasons.audio = [
          `Audio too short: ${totalDuration.toFixed(1)}s (minimum 10 seconds required)`
        ];
        logger.info('❌ Audio enrichment not possible: Duration too short', {
          actualDuration: totalDuration,
          minimumRequired: 10,
          segmentCount: session.audioSegments.length,
          segments: session.audioSegments.map(s => ({
            duration: s.duration,
            startTime: s.startTime,
          })),
        });
      } else {
        capability.audio = true;
        logger.info('✅ Audio enrichment possible', {
          totalDuration,
          segmentCount: session.audioSegments.length,
        });
      }
    }

    // Check video OR screenshots
    if (!session.video) {
      // No video structure - check if screenshots available
      if (session.screenshots && session.screenshots.length >= 5) {
        capability.video = true;
        logger.info('✅ Video enrichment possible using screenshots', {
          screenshotCount: session.screenshots.length,
        });
      } else {
        capability.video = false;
        capability.reasons.video = ['No video data and insufficient screenshots (need at least 5)'];
        logger.info('❌ Video enrichment not possible: No video and insufficient screenshots', {
          hasVideoObject: !!session.video,
          screenshotCount: session.screenshots?.length || 0,
        });
      }
    } else if (!session.video.fullVideoAttachmentId) {
      // Has video structure but no file - check screenshots
      if (session.screenshots && session.screenshots.length >= 5) {
        capability.video = true;
        logger.info('✅ Video enrichment possible using screenshots (no video file)', {
          screenshotCount: session.screenshots.length,
        });
      } else {
        capability.video = false;
        capability.reasons.video = ['No video recording file and insufficient screenshots'];
        logger.info('❌ Video enrichment not possible: No video file and insufficient screenshots', {
          fullVideoAttachmentId: session.video.fullVideoAttachmentId,
          screenshotCount: session.screenshots?.length || 0,
        });
      }
    } else if (!session.video.duration || session.video.duration < 60) {
      // Video too short - still allow if screenshots available
      if (session.screenshots && session.screenshots.length >= 5) {
        capability.video = true;
        logger.info('✅ Video enrichment possible using screenshots (video too short)', {
          videoDuration: session.video.duration || 0,
          screenshotCount: session.screenshots.length,
        });
      } else {
        capability.video = false;
        const actualDuration = session.video.duration || 0;
        capability.reasons.video = [
          `Video too short: ${actualDuration.toFixed(1)}s (minimum 60 seconds required) and no screenshots available`
        ];
        logger.info('❌ Video enrichment not possible: Duration too short and no screenshots', {
          actualDuration,
          minimumRequired: 60,
          screenshotCount: session.screenshots?.length || 0,
        });
      }
    } else {
      capability.video = true;
      logger.info('✅ Video enrichment possible', {
        duration: session.video.duration,
        fullVideoAttachmentId: session.video.fullVideoAttachmentId,
      });
    }

    logger.info('📋 Enrichment capability summary', {
      canEnrichAudio: capability.audio,
      canEnrichVideo: capability.video,
      audioReasons: capability.reasons.audio || 'N/A',
      videoReasons: capability.reasons.video || 'N/A',
    });

    return capability;
  }

  /**
   * Cancel an in-progress enrichment
   *
   * @param sessionId - Session ID to cancel
   */
  async cancelEnrichment(sessionId: string): Promise<void> {
    const logger = this.createLogger(sessionId);
    logger.info('Cancelling enrichment');

    // Force release lock
    await this.lockService.forceReleaseLock(sessionId);

    // Mark checkpoint as non-resumable
    const checkpoint = await this.checkpointService.loadCheckpoint(sessionId);
    if (checkpoint) {
      await this.checkpointService.updateCheckpoint(checkpoint.id, {
        canResume: false,
      });
    }

    logger.info('Enrichment cancelled');
  }

  /**
   * Resume a failed enrichment from checkpoint
   *
   * @param sessionId - Session ID to resume
   * @param onProgress - Progress callback
   * @returns Enrichment results
   */
  async resumeEnrichment(
    sessionId: string,
    onProgress?: (progress: EnrichmentProgress) => void
  ): Promise<EnrichmentResult> {
    const logger = this.createLogger(sessionId);
    logger.info('Resuming enrichment from checkpoint');

    // Load checkpoint
    const checkpoint = await this.checkpointService.loadCheckpoint(sessionId);
    if (!checkpoint) {
      throw new Error('No checkpoint found for session');
    }

    if (!checkpoint.canResume) {
      throw new Error('Checkpoint cannot be resumed (max retries exceeded or cancelled)');
    }

    // Increment retry count
    await this.checkpointService.incrementRetryCount(checkpoint.id);

    // Load session (Phase 4: use ChunkedStorage)
    const chunkedStorage = await getChunkedStorage();
    const session = await chunkedStorage.loadFullSession(sessionId);

    if (!session) {
      // Graceful handling: Session may have been deleted
      console.warn(`[Enrichment] Session ${sessionId} not found - cannot resume from checkpoint`);
      logger.warn('Session not found during checkpoint resume', {
        sessionId,
        checkpointStage: checkpoint.stage,
      });
      throw new Error('Session not found - may have been deleted');
    }

    // Resume enrichment with partial results
    logger.info('Resuming from checkpoint', {
      stage: checkpoint.stage,
      progress: checkpoint.progress,
      retryCount: checkpoint.retryCount,
    });

    return this.enrichSession(session, {
      includeAudio: !checkpoint.partialResults.audio?.fullAudioAttachmentId,
      includeVideo: !checkpoint.partialResults.video,
      includeSummary: true,
      resumeFromCheckpoint: true,
      onProgress,
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Enrich session with audio review
   */
  private async enrichAudio(
    session: Session,
    checkpointId: string,
    onProgress: (progress: EnrichmentProgress) => void
  ): Promise<EnrichmentResult['audio']> {
    const logger = this.createLogger(session.id);
    const startTime = Date.now();

    const totalAudioDuration = session.audioSegments?.reduce((sum, seg) => sum + seg.duration, 0) || 0;

    logger.info('🎤 Starting audio enrichment', {
      sessionId: session.id,
      sessionName: session.name,
      audioSegmentCount: session.audioSegments?.length || 0,
      totalAudioDuration,
      hasAudioSegments: !!session.audioSegments && session.audioSegments.length > 0,
    });

    try {
      // Validate audio data before processing
      if (!session.audioSegments || session.audioSegments.length === 0) {
        const error = new Error('No audio segments available for enrichment');
        logger.error('❌ Audio enrichment failed: No audio segments', {
          hasAudioSegments: !!session.audioSegments,
          segmentCount: session.audioSegments?.length || 0,
        });
        throw error;
      }

      if (totalAudioDuration < 10) {
        const error = new Error(`Audio too short for analysis: ${totalAudioDuration.toFixed(1)}s (minimum 10s required)`);
        logger.error('❌ Audio enrichment failed: Duration too short', {
          actualDuration: totalAudioDuration,
          minimumRequired: 10,
          shortfall: 10 - totalAudioDuration,
        });
        throw error;
      }

      logger.info('🎧 Calling audio review service', {
        totalAudioDuration,
        segmentCount: session.audioSegments.length,
      });

      // Run audio review with EnrichmentErrorHandler for robust error handling
      let audioResult;
      let attemptNumber = 0;
      const maxAttempts = 3;

      while (attemptNumber < maxAttempts) {
        try {
          attemptNumber++;
          audioResult = await audioReviewService.reviewSession(session, (progress) => {
            onProgress({
              stage: 'audio',
              message: progress.message,
              progress: 30 + (progress.progress / 100) * 40, // 30-70% of total
            });
          });
          break; // Success - exit retry loop
        } catch (error: any) {
          const resolution = await this.errorHandler.handleError(error, {
            sessionId: session.id,
            operation: 'audio-review',
            attemptNumber,
          });

          logger.error(`Audio enrichment error (attempt ${attemptNumber}/${maxAttempts})`, {
            error: resolution.backendDetails.error,
            shouldRetry: resolution.shouldRetry,
            retryDelay: resolution.retryDelay,
          });

          if (resolution.shouldRetry && attemptNumber < maxAttempts) {
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, resolution.retryDelay || 1000));
            logger.info(`Retrying audio enrichment after ${resolution.retryDelay}ms...`);
          } else {
            // Max retries or permanent error
            logger.error('Audio enrichment failed permanently', resolution.backendDetails);
            throw new Error(resolution.userMessage);
          }
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      const costEstimate = audioReviewService.getCostEstimate(session);

      // Ensure audioResult was successfully obtained
      if (!audioResult) {
        throw new Error('Audio enrichment failed: No result obtained after retries');
      }

      // Update checkpoint
      await this.checkpointService.updateCheckpoint(checkpointId, {
        stage: 'video',
        progress: 70,
        partialResults: {
          audio: {
            fullAudioAttachmentId: audioResult.fullAudioAttachmentId,
            processingTime: duration * 1000,
          },
        },
      });

      logger.info('✅ Audio enrichment completed successfully', {
        duration,
        cost: costEstimate.cost,
        transcriptionLength: audioResult.fullTranscription?.length || 0,
        hasInsights: !!audioResult.insights,
        upgradedSegmentCount: audioResult.upgradedSegments?.length || 0,
      });

      return {
        completed: true,
        fullTranscription: audioResult.fullTranscription,
        fullAudioAttachmentId: audioResult.fullAudioAttachmentId,
        insights: audioResult.insights,
        upgradedSegments: audioResult.upgradedSegments,
        cost: costEstimate.cost,
        duration,
      };
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error('❌ Audio enrichment failed', {
        error: error.message,
        stack: error.stack,
        duration,
        sessionId: session.id,
        totalAudioDuration,
        segmentCount: session.audioSegments?.length || 0,
      });
      throw error;
    }
  }

  /**
   * Enrich session with video chapter generation
   */
  private async enrichVideo(
    session: Session,
    checkpointId: string,
    onProgress: (progress: EnrichmentProgress) => void
  ): Promise<EnrichmentResult['video']> {
    const logger = this.createLogger(session.id);
    const startTime = Date.now();

    logger.info('🎥 Starting video enrichment', {
      sessionId: session.id,
      sessionName: session.name,
      videoDuration: session.video?.duration,
      fullVideoAttachmentId: session.video?.fullVideoAttachmentId,
      hasVideo: !!session.video,
      videoStartTime: session.video?.startTime,
      videoEndTime: session.video?.endTime,
    });

    try {
      // Note: Validation is minimal here because proposeChapters() handles both video AND screenshots
      // The chaptering service will use video if available, otherwise fall back to screenshots

      const hasVideo = !!session.video?.fullVideoAttachmentId;
      const hasScreenshots = session.screenshots && session.screenshots.length >= 5;

      if (!hasVideo && !hasScreenshots) {
        const error = new Error('No video or screenshots available for chaptering');
        logger.error('❌ Video enrichment failed: No data source', {
          hasVideo,
          hasScreenshots: !!session.screenshots,
          screenshotCount: session.screenshots?.length || 0,
        });
        throw error;
      }

      onProgress({
        stage: 'video',
        message: 'Generating video chapters...',
        progress: 70,
      });

      logger.info('🎬 Calling video chaptering service', {
        hasVideo,
        videoDuration: session.video?.duration || 'N/A',
        fullVideoAttachmentId: session.video?.fullVideoAttachmentId || 'N/A',
        hasScreenshots,
        screenshotCount: session.screenshots?.length || 0,
      });

      // Run video chaptering with EnrichmentErrorHandler for robust error handling
      let proposedChapters;
      let attemptNumber = 0;
      const maxAttempts = 3;

      while (attemptNumber < maxAttempts) {
        try {
          attemptNumber++;
          proposedChapters = await videoChapteringService.proposeChapters(session);
          break; // Success - exit retry loop
        } catch (error: any) {
          const resolution = await this.errorHandler.handleError(error, {
            sessionId: session.id,
            operation: 'video-chaptering',
            attemptNumber,
          });

          logger.error(`Video enrichment error (attempt ${attemptNumber}/${maxAttempts})`, {
            error: resolution.backendDetails.error,
            shouldRetry: resolution.shouldRetry,
            retryDelay: resolution.retryDelay,
          });

          if (resolution.shouldRetry && attemptNumber < maxAttempts) {
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, resolution.retryDelay || 1000));
            logger.info(`Retrying video enrichment after ${resolution.retryDelay}ms...`);
          } else {
            // Max retries or permanent error
            logger.error('Video enrichment failed permanently', resolution.backendDetails);
            throw new Error(resolution.userMessage);
          }
        }
      }

      // Ensure proposedChapters was successfully obtained
      if (!proposedChapters) {
        throw new Error('Video chaptering failed: No chapters obtained after retries');
      }

      // Convert ChapterProposal[] to VideoChapter[] by adding required fields
      // NOTE: We don't call saveChapters() here to avoid race condition
      // Chapters will be saved atomically by updateSessionWithResults()
      const chapters: VideoChapter[] = proposedChapters.map(proposal => ({
        id: `chapter-${session.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        sessionId: session.id,
        startTime: proposal.startTime,
        endTime: proposal.endTime,
        title: proposal.title,
        summary: proposal.summary,
        keyTopics: proposal.keyTopics,
        confidence: proposal.confidence,
        createdAt: new Date().toISOString(),
      }));

      const duration = (Date.now() - startTime) / 1000;

      // Calculate video duration for cost estimation
      // Use actual video duration, or estimate from session duration if using screenshots
      const videoDuration = session.video?.duration ||
        ((session.endTime ? new Date(session.endTime).getTime() : Date.now()) - new Date(session.startTime).getTime()) / 1000;

      // Rough cost estimate (frames * cost per frame)
      const estimatedFrames = Math.ceil((videoDuration / 30) * 1);
      const estimatedCost = estimatedFrames * this.COST_PER_VIDEO_FRAME;

      // Update checkpoint
      await this.checkpointService.updateCheckpoint(checkpointId, {
        stage: 'summary',
        progress: 75,
        partialResults: {
          video: {
            processingTime: duration * 1000,
          },
        },
      });

      logger.info('✅ Video enrichment completed successfully', {
        duration,
        chapterCount: chapters.length,
        cost: estimatedCost,
        averageChapterDuration: chapters.length > 0 ? videoDuration / chapters.length : 0,
        chapters: chapters.map(c => ({
          startTime: c.startTime,
          endTime: c.endTime,
          title: c.title,
        })),
      });

      return {
        completed: true,
        chapters,
        cost: estimatedCost,
        duration,
      };
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      logger.error('❌ Video enrichment failed', {
        error: error.message,
        stack: error.stack,
        duration,
        sessionId: session.id,
        videoDuration: session.video?.duration,
        fullVideoAttachmentId: session.video?.fullVideoAttachmentId,
      });
      throw error;
    }
  }

  /**
   * Regenerate session summary with enriched data
   *
   * Now supports both legacy and flexible (Phase 2) summary generation.
   * For completed sessions with enriched data, uses flexible summaries where AI chooses relevant sections.
   */
  private async enrichSummary(
    session: Session,
    freshEnrichment: Pick<EnrichmentResult, 'audio' | 'video'>,
    onProgress: (progress: EnrichmentProgress) => void
  ): Promise<EnrichmentResult['summary']> {
    const logger = this.createLogger(session.id);
    const startTime = Date.now();

    logger.info('Regenerating session summary');

    try {
      onProgress({
        stage: 'summary',
        message: 'Regenerating session summary...',
        progress: 80,
      });

      // Get latest session data (Phase 4: use ChunkedStorage)
      const chunkedStorage = await getChunkedStorage();
      const latestSession = await chunkedStorage.loadFullSession(session.id);

      if (!latestSession) {
        // Graceful handling: Session may have been deleted during enrichment
        console.warn(`[Enrichment] Session ${session.id} not found in storage - may have been deleted during enrichment`);
        logger.warn('Session not found during summary generation', {
          sessionId: session.id,
          stage: 'summary_generation',
        });

        // Return partial results instead of throwing
        return {
          completed: false,
          summary: null,
          duration: 0,
          error: 'Session not found - may have been deleted during enrichment',
        };
      }

      // Collect existing categories, subcategories, and tags from all sessions for consistency
      const existingCategories = new Set<string>();
      const existingSubCategories = new Set<string>();
      const existingTags = new Set<string>();

      // Load all session metadata (Phase 4: ChunkedStorage)
      const allMetadata = await chunkedStorage.listAllMetadata();
      allMetadata.forEach((metadata) => {
        if (metadata.category) existingCategories.add(metadata.category);
        if (metadata.subCategory) existingSubCategories.add(metadata.subCategory);
        if (metadata.tags && Array.isArray(metadata.tags)) {
          metadata.tags.forEach((tag) => existingTags.add(tag));
        }
      });

      // Priority 1: Use fresh enrichment results (just completed in pipeline)
      // Priority 2: Fallback to storage (for skipped/failed stages or previous enrichments)
      const videoChapters = freshEnrichment.video?.chapters || latestSession.video?.chapters;
      const audioInsights = freshEnrichment.audio?.insights || latestSession.audioInsights;

      logger.info('Enrichment context collected', {
        existingCategories: existingCategories.size,
        existingSubCategories: existingSubCategories.size,
        existingTags: existingTags.size,
        hasVideoChapters: !!videoChapters && videoChapters.length > 0,
        hasAudioInsights: !!audioInsights,
        // Verify data source for debugging
        videoSource: freshEnrichment.video?.chapters
          ? 'FRESH_PIPELINE'
          : (latestSession.video?.chapters ? 'STORAGE_FALLBACK' : 'NONE'),
        audioSource: freshEnrichment.audio?.insights
          ? 'FRESH_PIPELINE'
          : (latestSession.audioInsights ? 'STORAGE_FALLBACK' : 'NONE'),
        videoChapterCount: videoChapters?.length || 0,
        audioInsightsKeys: audioInsights ? Object.keys(audioInsights) : [],
      });

      // Decide whether to use flexible (Phase 2) or legacy summary generation
      // Use flexible summaries for completed sessions with enriched audio/video data
      const useFlexibleSummary =
        latestSession.status === 'completed' &&
        (!!audioInsights || (!!videoChapters && videoChapters.length > 0));

      logger.info('Summary generation strategy', {
        useFlexibleSummary,
        sessionStatus: latestSession.status,
        hasAudioInsights: !!audioInsights,
        hasVideoChapters: !!videoChapters && videoChapters.length > 0,
      });

      let summary: any;

      if (useFlexibleSummary) {
        // Phase 2: Generate flexible summary with AI-chosen sections
        onProgress({
          stage: 'summary',
          message: 'Generating AI-powered flexible summary...',
          progress: 85,
        });

        // Get API key from Tauri storage
        const apiKey = await invoke<string | null>('get_claude_api_key');
        if (!apiKey) {
          logger.warn('No API key found, falling back to legacy summary');
          // Fallback to legacy
          summary = await sessionsAgentService.generateSessionSummary(
            latestSession,
            latestSession.screenshots || [],
            latestSession.audioSegments || [],
            {
              existingCategories: Array.from(existingCategories),
              existingSubCategories: Array.from(existingSubCategories),
              existingTags: Array.from(existingTags),
              videoChapters,
              audioInsights,
            }
          );
        } else {
          logger.info('🎨 Generating flexible summary (Phase 2)...');

          try {
            summary = await generateFlexibleSummary(
              latestSession,
              latestSession.screenshots || [],
              latestSession.audioSegments || [],
              {
                existingCategories: Array.from(existingCategories),
                existingSubCategories: Array.from(existingSubCategories),
                existingTags: Array.from(existingTags),
                videoChapters,
                audioInsights,
              },
              apiKey
            );

            logger.info('✅ Flexible summary generated', {
              schemaVersion: summary.schemaVersion,
              sectionCount: summary.sections?.length || 0,
              detectedSessionType: summary.generationMetadata?.detectedSessionType,
              emphasis: summary.generationMetadata?.emphasis,
            });
          } catch (flexError: any) {
            logger.error('Flexible summary generation failed, falling back to legacy', flexError);
            // Fallback to legacy on error
            summary = await sessionsAgentService.generateSessionSummary(
              latestSession,
              latestSession.screenshots || [],
              latestSession.audioSegments || [],
              {
                existingCategories: Array.from(existingCategories),
                existingSubCategories: Array.from(existingSubCategories),
                existingTags: Array.from(existingTags),
                videoChapters,
                audioInsights,
              }
            );
          }
        }
      } else {
        // Legacy: Generate standard summary
        logger.info('📝 Generating legacy summary...');
        summary = await sessionsAgentService.generateSessionSummary(
          latestSession,
          latestSession.screenshots || [],
          latestSession.audioSegments || [],
          {
            existingCategories: Array.from(existingCategories),
            existingSubCategories: Array.from(existingSubCategories),
            existingTags: Array.from(existingTags),
            videoChapters,
            audioInsights,
          }
        );
      }

      const duration = (Date.now() - startTime) / 1000;
      const estimatedCost = this.ESTIMATED_SUMMARY_TOKENS * this.COST_PER_SUMMARY_TOKEN;

      // Extract category/tags from flexible summary if needed
      let category = summary.category;
      let subCategory = summary.subCategory;
      let tags = summary.tags;

      // Flexible summaries don't have category/subCategory at top level
      if (summary.schemaVersion === '2.0') {
        // Extract from quickAccess or infer from session type
        const sessionType = summary.generationMetadata?.detectedSessionType || 'mixed';
        category = this.inferCategoryFromSessionType(sessionType);
        subCategory = summary.generationMetadata?.primaryTheme || 'Work Session';
        tags = summary.quickAccess?.achievements?.slice(0, 3).map((a: string) =>
          a.toLowerCase().replace(/\s+/g, '-').slice(0, 20)
        ) || ['work'];
      }

      logger.info('Summary regeneration completed', {
        duration,
        cost: estimatedCost,
        summaryType: summary.schemaVersion === '2.0' ? 'flexible' : 'legacy',
        suggestedCategory: category,
        suggestedSubCategory: subCategory,
        suggestedTags: tags?.length || 0,
      });

      return {
        completed: true,
        summary: {
          ...summary,
          category,
          subCategory,
          tags,
        },
        duration,
      };
    } catch (error: any) {
      logger.error('Summary regeneration failed', error);
      throw error;
    }
  }

  /**
   * Infer category from detected session type (for flexible summaries)
   */
  private inferCategoryFromSessionType(sessionType: string): string {
    const mapping: Record<string, string> = {
      'deep-work': 'Deep Work',
      'exploratory': 'Research',
      'troubleshooting': 'Deep Work',
      'collaborative': 'Collaboration',
      'learning': 'Research',
      'creative': 'Deep Work',
      'routine': 'Quick Tasks',
      'mixed': 'Mixed Work',
    };
    return mapping[sessionType] || 'Deep Work';
  }

  /**
   * Process related-context section and create bidirectional links
   *
   * Links tasks/notes to the session by:
   * 1. Updating task.sourceSessionId / note.sourceSessionId
   * 2. Adding IDs to session.extractedTaskIds / session.extractedNoteIds
   *
   * This creates a bidirectional relationship for easy navigation and
   * ensures referential integrity across the knowledge graph.
   *
   * @param sessionId - Session to link items to
   * @param relatedSection - Related context section from AI summary
   * @param logger - Logger instance for tracking
   */
  private async processRelatedContextLinks(
    sessionId: string,
    relatedSection: RelatedContextSection,
    logger: ReturnType<typeof this.createLogger>
  ): Promise<{
    tasksLinked: number;
    notesLinked: number;
    errors: string[];
  }> {
    const result = {
      tasksLinked: 0,
      notesLinked: 0,
      errors: [] as string[],
    };

    try {
      const storage = await getStorage();

      // Process task links
      if (relatedSection.data.relatedTasks.length > 0) {
        try {
          const tasks = await storage.load<Task[]>('tasks') || [];
          let tasksUpdated = false;

          relatedSection.data.relatedTasks.forEach(relatedTask => {
            const task = tasks.find(t => t.id === relatedTask.taskId);
            if (task) {
              // Only update if not already linked to this session
              if (task.sourceSessionId !== sessionId) {
                task.sourceSessionId = sessionId;
                tasksUpdated = true;
                result.tasksLinked++;
                logger.info('Linked task to session', {
                  taskId: task.id,
                  taskTitle: task.title,
                  sessionId,
                });
              }
            } else {
              const error = `Task ${relatedTask.taskId} not found`;
              result.errors.push(error);
              logger.warn(error);
            }
          });

          if (tasksUpdated) {
            await storage.save('tasks', tasks);
            logger.info('Tasks updated with session links', {
              count: result.tasksLinked,
            });
          }
        } catch (error: any) {
          const errorMsg = `Failed to link tasks: ${error.message}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg, error);
        }
      }

      // Process note links
      if (relatedSection.data.relatedNotes.length > 0) {
        try {
          const notes = await storage.load<Note[]>('notes') || [];
          let notesUpdated = false;

          relatedSection.data.relatedNotes.forEach(relatedNote => {
            const note = notes.find(n => n.id === relatedNote.noteId);
            if (note) {
              // Only update if not already linked to this session
              if (note.sourceSessionId !== sessionId) {
                note.sourceSessionId = sessionId;
                notesUpdated = true;
                result.notesLinked++;
                logger.info('Linked note to session', {
                  noteId: note.id,
                  noteSummary: note.summary.substring(0, 50),
                  sessionId,
                });
              }
            } else {
              const error = `Note ${relatedNote.noteId} not found`;
              result.errors.push(error);
              logger.warn(error);
            }
          });

          if (notesUpdated) {
            await storage.save('notes', notes);
            logger.info('Notes updated with session links', {
              count: result.notesLinked,
            });
          }
        } catch (error: any) {
          const errorMsg = `Failed to link notes: ${error.message}`;
          result.errors.push(errorMsg);
          logger.error(errorMsg, error);
        }
      }

      return result;
    } catch (error: any) {
      logger.error('Critical error in processRelatedContextLinks', error);
      result.errors.push(`Critical error: ${error.message}`);
      return result;
    }
  }

  /**
   * Update session with enrichment results
   *
   * Uses optimistic locking to prevent concurrent writes from overwriting enrichment results.
   */
  private async updateSessionWithResults(
    session: Session,
    result: EnrichmentResult
  ): Promise<void> {
    const logger = this.createLogger(session.id);
    logger.info('Updating session with enrichment results via ChunkedStorage');

    try {
      // Get ChunkedStorage instance
      const chunkedStorage = await getChunkedStorage();

      // Load current metadata
      const metadata = await chunkedStorage.loadMetadata(session.id);
      if (!metadata) {
        throw new Error(`Session ${session.id} not found in ChunkedStorage`);
      }

      // Build updates object for metadata
      const metadataUpdates: Partial<SessionMetadata> = {};

      // Update audio results
      if (result.audio?.completed) {
        metadataUpdates.audioReviewCompleted = true;
        metadataUpdates.fullAudioAttachmentId = result.audio.fullAudioAttachmentId;
        metadataUpdates.transcriptUpgradeCompleted = !!result.audio.upgradedSegments;
        metadataUpdates.hasAudioInsights = !!result.audio.insights;

        // Save audio insights to separate file
        if (result.audio.insights) {
          logger.info('Saving audio insights');
          await chunkedStorage.saveAudioInsights(session.id, result.audio.insights);
        }

        // Save transcription to separate file
        if (result.audio.fullTranscription) {
          logger.info('Saving full transcription');
          await chunkedStorage.saveTranscription(session.id, result.audio.fullTranscription);
        }

        // Update audio segments if upgraded
        if (result.audio.upgradedSegments) {
          logger.info('Saving upgraded audio segments');
          await chunkedStorage.saveAudioSegments(session.id, result.audio.upgradedSegments);
        }
      }

      // Update video results - save chapters to metadata
      if (result.video?.completed && result.video.chapters && metadata.video) {
        // Update chapters in video metadata
        metadataUpdates.video = {
          ...metadata.video,
          chapters: result.video.chapters,
        };

        logger.info('✅ Video chapters updated in metadata', {
          chapterCount: result.video.chapters.length,
        });
      }

      // Update summary
      if (result.summary?.completed && result.summary.summary) {
        metadataUpdates.hasSummary = true;
        metadataUpdates.category = result.summary.summary.category;
        metadataUpdates.subCategory = result.summary.summary.subCategory;
        metadataUpdates.tags = result.summary.summary.tags;

        // Save summary to separate file
        logger.info('Saving session summary');
        await chunkedStorage.saveSummary(session.id, result.summary.summary);

        // Process related-context section if present (flexible summaries only)
        if (isFlexibleSummary(result.summary.summary)) {
          const relatedSection = result.summary.summary.sections.find(
            s => s.type === 'related-context'
          ) as RelatedContextSection | undefined;

          if (relatedSection) {
            logger.info('Processing related context links', {
              tasks: relatedSection.data.relatedTasks.length,
              notes: relatedSection.data.relatedNotes.length,
            });

            const linkResult = await this.processRelatedContextLinks(
              session.id,
              relatedSection,
              logger
            );

            logger.info('Related context linking complete', {
              tasksLinked: linkResult.tasksLinked,
              notesLinked: linkResult.notesLinked,
              errors: linkResult.errors.length,
            });

            // Add to warnings if there were errors (non-fatal)
            if (linkResult.errors.length > 0) {
              result.warnings.push(...linkResult.errors);
            }

            // Update session's extracted IDs arrays
            const linkedTaskIds = relatedSection.data.relatedTasks.map(t => t.taskId);
            const linkedNoteIds = relatedSection.data.relatedNotes.map(n => n.noteId);

            // Merge with existing (avoid duplicates)
            metadataUpdates.extractedTaskIds = Array.from(new Set([
              ...metadata.extractedTaskIds,
              ...linkedTaskIds,
            ]));

            metadataUpdates.extractedNoteIds = Array.from(new Set([
              ...metadata.extractedNoteIds,
              ...linkedNoteIds,
            ]));

            logger.info('Session extracted IDs updated', {
              totalTaskIds: metadataUpdates.extractedTaskIds.length,
              totalNoteIds: metadataUpdates.extractedNoteIds.length,
            });
          }
        }
      }

      // Update canvas - THIS IS THE KEY FIX FOR CANVAS PERSISTENCE
      if (result.canvas?.completed && result.canvas.canvasSpec) {
        metadataUpdates.hasCanvasSpec = true;

        // Save canvas spec to separate file (canvas-spec.json)
        logger.info('Saving canvas spec via ChunkedStorage');
        await chunkedStorage.saveCanvasSpec(session.id, result.canvas.canvasSpec);
        logger.info('✅ Canvas spec saved to chunked storage (canvas-spec.json)');
      }

      // Update enrichment status
      metadataUpdates.enrichmentStatus = {
        status: result.success ? 'completed' : 'failed',
        completedAt: new Date().toISOString(),
        progress: 100,
        currentStage: 'complete',
        audio: {
          status: result.audio?.completed ? 'completed' : result.audio?.error ? 'failed' : 'skipped',
          completedAt: result.audio?.completed ? new Date().toISOString() : undefined,
          error: result.audio?.error,
          cost: result.audio?.cost,
        },
        video: {
          status: result.video?.completed ? 'completed' : result.video?.error ? 'failed' : 'skipped',
          completedAt: result.video?.completed ? new Date().toISOString() : undefined,
          error: result.video?.error,
          cost: result.video?.cost,
        },
        summary: {
          status: result.summary?.completed ? 'completed' : result.summary?.error ? 'failed' : 'skipped',
          error: result.summary?.error,
        },
        totalCost: result.totalCost,
        errors: [
          ...(result.audio?.error ? [result.audio.error] : []),
          ...(result.video?.error ? [result.video.error] : []),
          ...(result.summary?.error ? [result.summary.error] : []),
        ],
        warnings: result.warnings,
        canResume: false,
      };

      // Merge all updates into metadata and save
      const updatedMetadata: SessionMetadata = {
        ...metadata,
        ...metadataUpdates,
        updatedAt: new Date().toISOString(),
      };

      // Save metadata atomically
      await chunkedStorage.saveMetadata(updatedMetadata);

      logger.info('✅ Session updated with enrichment results via ChunkedStorage', {
        audioCompleted: result.audio?.completed,
        videoCompleted: result.video?.completed,
        chaptersCount: result.video?.chapters?.length || 0,
        summaryCompleted: result.summary?.completed,
        canvasCompleted: result.canvas?.completed,
      });

    } catch (error: any) {
      logger.error('Failed to update session with enrichment results', error);
      throw error;
    }
  }

  /**
   * Hash audio data using SHA-256
   *
   * @param audioSegments - Audio segments to hash
   * @returns SHA-256 hash (hex string)
   */
  private async hashAudioData(audioSegments: SessionAudioSegment[]): Promise<string> {
    try {
      const { sha256 } = await import('@noble/hashes/sha2.js');
      const { bytesToHex } = await import('@noble/hashes/utils.js');

      // Create stable representation of audio data
      const dataToHash = audioSegments
        .map((seg) => `${seg.id}:${seg.duration}:${seg.startTime}`)
        .join('|');

      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBytes = sha256(data);
      const hashHex = bytesToHex(hashBytes);

      return hashHex;
    } catch (error) {
      console.error('[SessionEnrichment] Failed to hash audio data', error);
      return '';
    }
  }

  /**
   * Hash video data using SHA-256
   *
   * @param screenshots - Screenshots to hash
   * @returns SHA-256 hash (hex string)
   */
  private async hashVideoData(screenshots: SessionScreenshot[]): Promise<string> {
    try {
      const { sha256 } = await import('@noble/hashes/sha2.js');
      const { bytesToHex } = await import('@noble/hashes/utils.js');

      // Create stable representation of video data
      const dataToHash = screenshots
        .map((shot) => `${shot.id}:${shot.timestamp}:${shot.attachmentId}`)
        .join('|');

      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBytes = sha256(data);
      const hashHex = bytesToHex(hashBytes);

      return hashHex;
    } catch (error) {
      console.error('[SessionEnrichment] Failed to hash video data', error);
      return '';
    }
  }

  /**
   * Create a logger for session enrichment operations
   */
  private createLogger(sessionId: string) {
    const prefix = `[SessionEnrichment:${sessionId.slice(0, 8)}]`;

    return {
      info: (message: string, data?: any) => {
        console.log(`${prefix} ${message}`, data || '');
      },
      warn: (message: string, data?: any) => {
        console.warn(`${prefix} ${message}`, data || '');
      },
      error: (message: string, error?: any) => {
        console.error(`${prefix} ${message}`, error || '');
      },
    };
  }
}

/**
 * Export singleton instance for convenience
 */
export const sessionEnrichmentService = new SessionEnrichmentService();
