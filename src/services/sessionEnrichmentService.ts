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
} from '../types';
import { audioReviewService } from './audioReviewService';
import { videoChapteringService } from './videoChapteringService';
import { sessionsAgentService } from './sessionsAgentService';
import { getCheckpointService, type EnrichmentCheckpoint } from './checkpointService';
import { getEnrichmentLockService } from './enrichmentLockService';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import { getStorage } from './storage';
import { generateId } from '../utils/helpers';

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

  /** Force regeneration even if already completed */
  forceRegenerate?: boolean;

  /** Maximum total cost threshold in USD */
  maxCost?: number;

  /** Resume from existing checkpoint if available */
  resumeFromCheckpoint?: boolean;

  /** Progress callback for real-time updates */
  onProgress?: (progress: EnrichmentProgress) => void;
}

export interface EnrichmentProgress {
  /** Current stage being processed */
  stage: 'validating' | 'estimating' | 'locking' | 'checkpointing' | 'audio' | 'video' | 'summary' | 'complete' | 'error';

  /** Human-readable progress message */
  message: string;

  /** Overall progress percentage (0-100) */
  progress: number;

  /** Detailed stage progress */
  stages?: {
    audio?: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'; progress: number };
    video?: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'; progress: number };
    summary?: { status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'; progress: number };
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

  // Cost estimation constants (as of 2025)
  private readonly COST_PER_AUDIO_MINUTE = 0.026; // GPT-4o audio preview
  private readonly COST_PER_TRANSCRIPT_UPGRADE = 0.002; // Whisper + Haiku batch merge per minute (~$0.0006 Whisper + ~$0.0014 Haiku)
  private readonly COST_PER_VIDEO_FRAME = 0.001; // Claude vision API (rough estimate)
  private readonly COST_PER_SUMMARY_TOKEN = 0.000003; // Claude Sonnet 3.5 output tokens
  private readonly ESTIMATED_SUMMARY_TOKENS = 1000; // Estimated tokens for summary

  // Default settings
  private readonly DEFAULT_MAX_COST = 10.0; // $10 USD
  private readonly DEFAULT_LOCK_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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

    // Default options
    const opts: Required<EnrichmentOptions> = {
      includeAudio: options.includeAudio ?? true,
      includeVideo: options.includeVideo ?? true,
      includeSummary: options.includeSummary ?? true,
      forceRegenerate: options.forceRegenerate ?? false,
      maxCost: options.maxCost ?? this.DEFAULT_MAX_COST,
      resumeFromCheckpoint: options.resumeFromCheckpoint ?? true,
      onProgress: options.onProgress ?? (() => {}),
    };

    const result: EnrichmentResult = {
      success: false,
      totalCost: 0,
      totalDuration: 0,
      warnings: [],
    };

    try {
      // Stage 1: Validation
      opts.onProgress({
        stage: 'validating',
        message: 'Validating session data...',
        progress: 5,
      });

      const capability = await this.canEnrich(session);
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

      // Check if already enriched (unless force regenerate)
      if (!opts.forceRegenerate) {
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
          const storage = await getStorage();
          const sessions = await storage.load<Session[]>('sessions');

          if (sessions) {
            const sessionIndex = sessions.findIndex((s) => s.id === session.id);
            if (sessionIndex !== -1) {
              sessions[sessionIndex].enrichmentStatus = {
                status: 'in-progress',
                progress: 25,
                currentStage: 'audio',
                audio: { status: opts.includeAudio ? 'pending' : 'skipped' },
                video: { status: opts.includeVideo ? 'pending' : 'skipped' },
                summary: { status: opts.includeSummary ? 'pending' : 'skipped' },
                totalCost: 0,
                errors: [],
                warnings: result.warnings,
                canResume: true,
              };
              await storage.save('sessions', sessions);
              logger.info('Enrichment status set to in-progress');
            }
          }
        } catch (error: any) {
          logger.warn('Failed to set enrichment status to in-progress', error);
          // Don't throw - this is non-critical for enrichment to proceed
        }

        try {
          // Stage 5: Parallel Enrichment
          const enrichmentPromises: Array<Promise<any>> = [];

          // Audio enrichment
          if (opts.includeAudio) {
            enrichmentPromises.push(
              this.enrichAudio(session, checkpoint.id, opts.onProgress)
            );
          } else {
            result.audio = {
              completed: false,
              cost: 0,
              duration: 0,
              // Don't set error field - undefined means skipped
            };
          }

          // Video enrichment
          if (opts.includeVideo) {
            enrichmentPromises.push(
              this.enrichVideo(session, checkpoint.id, opts.onProgress)
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
              const summaryResult = await this.enrichSummary(session, opts.onProgress);
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

          // Determine overall success BEFORE updating session (FIX: was calculated too late)
          result.success =
            (result.audio?.completed ?? false) ||
            (result.video?.completed ?? false) ||
            (result.summary?.completed ?? false);

          // Stage 7: Update Session
          await this.updateSessionWithResults(session, result);

          // Stage 8: Cleanup Checkpoint
          await this.checkpointService.deleteCheckpoint(checkpoint.id);
          logger.info('Checkpoint deleted');

          result.totalDuration = (Date.now() - startTime) / 1000;

          opts.onProgress({
            stage: 'complete',
            message: 'Enrichment complete!',
            progress: 100,
          });

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

      // FIX: Update session enrichmentStatus to 'failed' in storage
      try {
        const storage = await getStorage();
        const sessions = await storage.load<Session[]>('sessions');
        if (sessions) {
          const sessionIndex = sessions.findIndex((s) => s.id === session.id);
          if (sessionIndex !== -1) {
            sessions[sessionIndex].enrichmentStatus = {
              status: 'failed',
              completedAt: new Date().toISOString(),
              progress: 0,
              currentStage: 'complete',
              audio: { status: 'failed', error: error.message },
              video: { status: 'skipped' },
              summary: { status: 'skipped' },
              totalCost: result.totalCost,
              errors: [error.message],
              warnings: result.warnings,
              canResume: false,
            };
            await storage.save('sessions', sessions);
            logger.info('Session enrichmentStatus updated to failed');
          }
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

    // Load session
    const storage = await getStorage();
    const sessions = await storage.load<Session[]>('sessions');
    const session = sessions?.find((s) => s.id === sessionId);

    if (!session) {
      throw new Error('Session not found');
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

      // Run audio review with retry logic
      const audioResult = await retryWithBackoff(
        () =>
          audioReviewService.reviewSession(session, (progress) => {
            onProgress({
              stage: 'audio',
              message: progress.message,
              progress: 30 + (progress.progress / 100) * 40, // 30-70% of total
            });
          }),
        {
          maxRetries: 2,
          initialDelay: 5000,
          maxDelay: 30000,
        }
      );

      const duration = (Date.now() - startTime) / 1000;
      const costEstimate = audioReviewService.getCostEstimate(session);

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

      // Run video chaptering with retry logic
      const proposedChapters = await retryWithBackoff(
        () => videoChapteringService.proposeChapters(session),
        {
          maxRetries: 2,
          initialDelay: 5000,
          maxDelay: 30000,
        }
      );

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
   */
  private async enrichSummary(
    session: Session,
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

      // Get latest session data
      const storage = await getStorage();
      const sessions = await storage.load<Session[]>('sessions');
      const latestSession = sessions?.find((s) => s.id === session.id);

      if (!latestSession) {
        throw new Error('Session not found');
      }

      // Collect existing categories, subcategories, and tags from all sessions for consistency
      const existingCategories = new Set<string>();
      const existingSubCategories = new Set<string>();
      const existingTags = new Set<string>();

      (sessions || []).forEach((s) => {
        if (s.category) existingCategories.add(s.category);
        if (s.subCategory) existingSubCategories.add(s.subCategory);
        if (s.tags && Array.isArray(s.tags)) {
          s.tags.forEach((tag) => existingTags.add(tag));
        }
      });

      // Collect video chapters if available
      const videoChapters = latestSession.video?.chapters;

      // Collect audio insights if available
      const audioInsights = latestSession.audioInsights;

      logger.info('Enrichment context collected', {
        existingCategories: existingCategories.size,
        existingSubCategories: existingSubCategories.size,
        existingTags: existingTags.size,
        hasVideoChapters: !!videoChapters && videoChapters.length > 0,
        hasAudioInsights: !!audioInsights,
      });

      // Regenerate summary with enriched data and context for consistent categorization
      const summary = await sessionsAgentService.generateSessionSummary(
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

      const duration = (Date.now() - startTime) / 1000;
      const estimatedCost = this.ESTIMATED_SUMMARY_TOKENS * this.COST_PER_SUMMARY_TOKEN;

      logger.info('Summary regeneration completed', {
        duration,
        cost: estimatedCost,
        suggestedCategory: summary.category,
        suggestedSubCategory: summary.subCategory,
        suggestedTags: summary.tags?.length || 0,
      });

      return {
        completed: true,
        summary,
        duration,
      };
    } catch (error: any) {
      logger.error('Summary regeneration failed', error);
      throw error;
    }
  }

  /**
   * Update session with enrichment results
   */
  private async updateSessionWithResults(
    session: Session,
    result: EnrichmentResult
  ): Promise<void> {
    const logger = this.createLogger(session.id);
    logger.info('Updating session with enrichment results');

    try {
      const storage = await getStorage();
      const sessions = await storage.load<Session[]>('sessions');

      if (!sessions) {
        throw new Error('Sessions not found in storage');
      }

      const sessionIndex = sessions.findIndex((s) => s.id === session.id);
      if (sessionIndex === -1) {
        throw new Error('Session not found');
      }

      const updatedSession = sessions[sessionIndex];

      // Update audio results
      if (result.audio?.completed) {
        updatedSession.audioReviewCompleted = true;
        updatedSession.fullTranscription = result.audio.fullTranscription;
        updatedSession.fullAudioAttachmentId = result.audio.fullAudioAttachmentId;
        updatedSession.audioInsights = result.audio.insights;

        if (result.audio.upgradedSegments) {
          updatedSession.audioSegments = result.audio.upgradedSegments;
          updatedSession.transcriptUpgradeCompleted = true;
        }
      }

      // Update video results - save chapters atomically with other enrichment data
      if (result.video?.completed && result.video.chapters && updatedSession.video) {
        // Update chapters (video object must already exist from session recording)
        updatedSession.video.chapters = result.video.chapters;

        logger.info('✅ Video chapters updated', {
          chapterCount: result.video.chapters.length,
        });
      }

      // Update summary
      if (result.summary?.completed && result.summary.summary) {
        updatedSession.summary = result.summary.summary; // FIX: Store the full summary object
        updatedSession.category = result.summary.summary.category;
        updatedSession.subCategory = result.summary.summary.subCategory;
        updatedSession.tags = result.summary.summary.tags;
      }

      // Update enrichment status
      updatedSession.enrichmentStatus = {
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

      // Save updated sessions
      await storage.save('sessions', sessions);

      logger.info('Session updated successfully', {
        audioCompleted: result.audio?.completed,
        videoCompleted: result.video?.completed,
        chaptersCount: result.video?.chapters?.length || 0,
        summaryCompleted: result.summary?.completed,
      });

      // Verification: Reload and confirm chapters were saved (non-fatal)
      if (result.video?.completed && result.video.chapters && result.video.chapters.length > 0) {
        try {
          const verificationSessions = await storage.load<Session[]>('sessions');
          const verifiedSession = verificationSessions?.find(s => s.id === session.id);

          if (!verifiedSession?.video?.chapters || verifiedSession.video.chapters.length === 0) {
            logger.warn('⚠️ WARNING: Chapters not immediately visible in storage (may be timing)', {
              expectedChapters: result.video.chapters.length,
              actualChapters: verifiedSession?.video?.chapters?.length || 0,
            });
            // Don't throw - just log warning and add to warnings array
            result.warnings.push('Chapter verification failed (timing issue - chapters may appear after reload)');
          } else {
            logger.info('✅ Verification: Chapters confirmed in storage', {
              chapterCount: verifiedSession.video.chapters.length,
            });
          }
        } catch (verifyError: any) {
          // Verification failure should never crash enrichment
          logger.warn('⚠️ Chapter verification failed (non-fatal)', verifyError);
          result.warnings.push('Chapter verification failed - chapters may still be saved correctly');
        }
      }
    } catch (error: any) {
      logger.error('Failed to update session', error);
      throw error;
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
