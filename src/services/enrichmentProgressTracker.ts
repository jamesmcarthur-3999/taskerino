/**
 * Production-grade progress tracking system for unified enrichment
 * Aggregates progress from multiple parallel operations (audio, video, summary)
 */

export interface EnrichmentProgress {
  overall: number; // 0-100
  stage: 'initializing' | 'audio' | 'video' | 'summary' | 'finalizing' | 'complete';
  message: string;
  audio?: { progress: number; stage: string; message?: string };
  video?: { progress: number; stage: string; message?: string };
  summary?: { progress: number; stage: string; message?: string };
  estimatedTimeRemaining?: number; // seconds
}

interface StageProgress {
  progress: number; // 0-100
  stage: string;
  message?: string;
  completed: boolean;
  failed: boolean;
  error?: string;
}

interface ProgressWeights {
  audio: number;
  video: number;
  summary: number;
}

/**
 * Tracks progress across multiple parallel enrichment operations
 * with weighted progress calculation and time estimation
 */
export class EnrichmentProgressTracker {
  private stageProgress: Map<'audio' | 'video' | 'summary', StageProgress> = new Map();
  private startTime: number = Date.now();
  private lastUpdateTime: number = 0;
  private throttleDelay: number = 100; // 10 updates per second max
  private pendingUpdate: NodeJS.Timeout | null = null;
  private currentStage: 'initializing' | 'audio' | 'video' | 'summary' | 'finalizing' | 'complete' = 'initializing';
  private onProgress?: (progress: EnrichmentProgress) => void;
  private weights: ProgressWeights;

  constructor(
    onProgress?: (progress: EnrichmentProgress) => void,
    weights: ProgressWeights = { audio: 0.6, video: 0.3, summary: 0.1 }
  ) {
    this.onProgress = onProgress;
    this.weights = weights;
    // Validate weights sum to 1.0
    const sum = weights.audio + weights.video + weights.summary;
    if (Math.abs(sum - 1.0) > 0.001) {
      console.warn(
        `[EnrichmentProgressTracker] Weights sum to ${sum.toFixed(1)}, expected 1.0. Normalizing...`
      );
      const normalizedAudio = weights.audio / sum;
      const normalizedVideo = weights.video / sum;
      const normalizedSummary = weights.summary / sum;
      this.weights = {
        audio: normalizedAudio,
        video: normalizedVideo,
        summary: normalizedSummary
      };
    }

    // Initialize all stages
    this.stageProgress.set('audio', {
      progress: 0,
      stage: 'pending',
      completed: false,
      failed: false
    });
    this.stageProgress.set('video', {
      progress: 0,
      stage: 'pending',
      completed: false,
      failed: false
    });
    this.stageProgress.set('summary', {
      progress: 0,
      stage: 'pending',
      completed: false,
      failed: false
    });

    console.log('[EnrichmentProgressTracker] Initialized with weights:', this.weights);

    // Send initial progress
    this.emitProgress();
  }

  /**
   * Creates a sub-tracker function for a specific stage
   * Returns a callback that can be used to update progress for that stage
   */
  createSubTracker(
    stage: 'audio' | 'video' | 'summary',
    weight?: number
  ): (progress: number, message: string, substage?: string) => void {
    // Update weight if provided
    if (weight !== undefined && weight !== this.weights[stage]) {
      console.log(`[EnrichmentProgressTracker] Updating weight for ${stage}: ${this.weights[stage]} -> ${weight}`);
      this.weights[stage] = weight;
    }

    return (progress: number, message: string, substage?: string) => {
      this.updateStageProgress(stage, progress, message, substage);
    };
  }

  /**
   * Updates progress for a specific stage
   */
  private updateStageProgress(
    stage: 'audio' | 'video' | 'summary',
    progress: number,
    message: string,
    substage?: string
  ): void {
    const stageData = this.stageProgress.get(stage);
    if (!stageData) {
      console.error(`[EnrichmentProgressTracker] Unknown stage: ${stage}`);
      return;
    }

    // Validate progress
    const validProgress = Math.max(0, Math.min(100, progress));
    if (validProgress !== progress) {
      console.warn(
        `[EnrichmentProgressTracker] Progress for ${stage} out of bounds: ${progress}. Clamped to ${validProgress}`
      );
    }

    // Update stage data
    stageData.progress = validProgress;
    stageData.message = message;
    if (substage) {
      stageData.stage = substage;
    }

    // Update current stage if this is the most active one
    if (validProgress > 0 && validProgress < 100 && !stageData.completed && !stageData.failed) {
      this.currentStage = stage;
    }

    console.log(`[EnrichmentProgressTracker] ${stage}: ${validProgress}% - ${substage || 'in-progress'} - ${message}`);

    // Emit progress update (throttled)
    this.emitProgress();
  }

  /**
   * Marks a stage as complete
   */
  notifyComplete(stage: 'audio' | 'video' | 'summary'): void {
    const stageData = this.stageProgress.get(stage);
    if (!stageData) {
      console.error(`[EnrichmentProgressTracker] Unknown stage: ${stage}`);
      return;
    }

    stageData.progress = 100;
    stageData.completed = true;
    stageData.stage = 'complete';
    stageData.message = `${stage.charAt(0).toUpperCase() + stage.slice(1)} enrichment complete`;

    console.log(`[EnrichmentProgressTracker] ${stage} completed successfully`);

    // Check if all stages are complete
    const allComplete = Array.from(this.stageProgress.values()).every(
      s => s.completed || s.failed
    );

    if (allComplete) {
      this.currentStage = 'complete';
      console.log('[EnrichmentProgressTracker] All stages complete');
    } else {
      // Move to next active stage
      this.updateCurrentStage();
    }

    this.emitProgress();
  }

  /**
   * Marks a stage as failed
   */
  notifyError(stage: 'audio' | 'video' | 'summary', error: string): void {
    const stageData = this.stageProgress.get(stage);
    if (!stageData) {
      console.error(`[EnrichmentProgressTracker] Unknown stage: ${stage}`);
      return;
    }

    stageData.failed = true;
    stageData.error = error;
    stageData.stage = 'failed';
    stageData.message = error;

    console.error(`[EnrichmentProgressTracker] ${stage} failed: ${error}`);

    // Move to next active stage
    this.updateCurrentStage();

    this.emitProgress();
  }

  /**
   * Updates the current stage based on active operations
   */
  private updateCurrentStage(): void {
    // Check stages in priority order
    const stages: Array<'audio' | 'video' | 'summary'> = ['audio', 'video', 'summary'];

    for (const stage of stages) {
      const stageData = this.stageProgress.get(stage);
      if (stageData && !stageData.completed && !stageData.failed && stageData.progress > 0) {
        this.currentStage = stage;
        return;
      }
    }

    // If no active stage, check if all are complete
    const allComplete = Array.from(this.stageProgress.values()).every(
      s => s.completed || s.failed
    );

    if (allComplete) {
      this.currentStage = 'complete';
    } else {
      // Find first incomplete stage
      for (const stage of stages) {
        const stageData = this.stageProgress.get(stage);
        if (stageData && !stageData.completed && !stageData.failed) {
          this.currentStage = stage;
          return;
        }
      }
    }
  }

  /**
   * Calculates overall progress as weighted sum of stage progress
   */
  private calculateOverallProgress(): number {
    const audioProgress = this.stageProgress.get('audio')!;
    const videoProgress = this.stageProgress.get('video')!;
    const summaryProgress = this.stageProgress.get('summary')!;

    const overall =
      audioProgress.progress * this.weights.audio +
      videoProgress.progress * this.weights.video +
      summaryProgress.progress * this.weights.summary;

    return Math.max(0, Math.min(100, overall));
  }

  /**
   * Estimates remaining time based on elapsed time and progress
   */
  private estimateTimeRemaining(): number | undefined {
    const overallProgress = this.calculateOverallProgress();

    // Don't estimate if progress is too low or complete
    if (overallProgress < 1 || overallProgress >= 99.9) {
      return undefined;
    }

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;

    // Don't estimate if not enough time has passed
    if (elapsedSeconds < 1) {
      return undefined;
    }

    // Calculate rate of progress
    const progressRate = overallProgress / elapsedSeconds; // percent per second

    // Avoid division by zero
    if (progressRate <= 0) {
      return undefined;
    }

    const remainingProgress = 100 - overallProgress;
    const estimatedSeconds = remainingProgress / progressRate;

    // Cap at reasonable maximum (1 hour)
    const cappedEstimate = Math.min(estimatedSeconds, 3600);

    // Return undefined for unrealistic estimates
    if (cappedEstimate < 0 || !isFinite(cappedEstimate)) {
      return undefined;
    }

    return Math.round(cappedEstimate);
  }

  /**
   * Gets current progress state
   */
  getCurrentProgress(): EnrichmentProgress {
    const overall = this.calculateOverallProgress();
    const audioData = this.stageProgress.get('audio')!;
    const videoData = this.stageProgress.get('video')!;
    const summaryData = this.stageProgress.get('summary')!;

    // Generate overall message based on current stage
    let message: string;
    switch (this.currentStage) {
      case 'initializing':
        message = 'Initializing enrichment process...';
        break;
      case 'audio':
        message = audioData.message || 'Processing audio...';
        break;
      case 'video':
        message = videoData.message || 'Processing video...';
        break;
      case 'summary':
        message = summaryData.message || 'Generating summary...';
        break;
      case 'finalizing':
        message = 'Finalizing enrichment...';
        break;
      case 'complete':
        message = 'Enrichment complete';
        break;
      default:
        message = 'Processing...';
    }

    const progress: EnrichmentProgress = {
      overall: Math.round(overall * 100) / 100, // Round to 2 decimal places
      stage: this.currentStage,
      message,
      estimatedTimeRemaining: this.estimateTimeRemaining()
    };

    // Include stage details if they've been started
    if (audioData.progress > 0 || audioData.completed || audioData.failed) {
      progress.audio = {
        progress: audioData.progress,
        stage: audioData.stage,
        message: audioData.message
      };
    }

    if (videoData.progress > 0 || videoData.completed || videoData.failed) {
      progress.video = {
        progress: videoData.progress,
        stage: videoData.stage,
        message: videoData.message
      };
    }

    if (summaryData.progress > 0 || summaryData.completed || summaryData.failed) {
      progress.summary = {
        progress: summaryData.progress,
        stage: summaryData.stage,
        message: summaryData.message
      };
    }

    return progress;
  }

  /**
   * Emits progress update with throttling
   */
  private emitProgress(): void {
    if (!this.onProgress) {
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    // If enough time has passed, emit immediately
    if (timeSinceLastUpdate >= this.throttleDelay) {
      this.lastUpdateTime = now;

      // Clear any pending update
      if (this.pendingUpdate) {
        clearTimeout(this.pendingUpdate);
        this.pendingUpdate = null;
      }

      const progress = this.getCurrentProgress();
      this.onProgress(progress);
    } else {
      // Schedule an update for later if one isn't already pending
      if (!this.pendingUpdate) {
        const delay = this.throttleDelay - timeSinceLastUpdate;
        this.pendingUpdate = setTimeout(() => {
          this.lastUpdateTime = Date.now();
          this.pendingUpdate = null;

          const progress = this.getCurrentProgress();
          this.onProgress!(progress);
        }, delay);
      }
    }
  }

  /**
   * Forces an immediate progress update, bypassing throttling
   * Useful for important state changes (completion, errors)
   */
  forceUpdate(): void {
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }

    this.lastUpdateTime = Date.now();

    if (this.onProgress) {
      const progress = this.getCurrentProgress();
      this.onProgress(progress);
    }
  }

  /**
   * Resets the tracker to initial state
   */
  reset(): void {
    console.log('[EnrichmentProgressTracker] Resetting tracker');

    // Clear pending update
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }

    // Reset all stages
    this.stageProgress.set('audio', {
      progress: 0,
      stage: 'pending',
      completed: false,
      failed: false
    });
    this.stageProgress.set('video', {
      progress: 0,
      stage: 'pending',
      completed: false,
      failed: false
    });
    this.stageProgress.set('summary', {
      progress: 0,
      stage: 'pending',
      completed: false,
      failed: false
    });

    this.startTime = Date.now();
    this.lastUpdateTime = 0;
    this.currentStage = 'initializing';

    this.emitProgress();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }

    console.log('[EnrichmentProgressTracker] Destroyed');
  }
}

/**
 * Helper function to create a simple progress tracker with default settings
 */
export function createEnrichmentProgressTracker(
  onProgress?: (progress: EnrichmentProgress) => void
): EnrichmentProgressTracker {
  return new EnrichmentProgressTracker(onProgress);
}

/**
 * Helper function to create a progress tracker with custom weights
 */
export function createCustomWeightedTracker(
  weights: Partial<ProgressWeights>,
  onProgress?: (progress: EnrichmentProgress) => void
): EnrichmentProgressTracker {
  const defaultWeights = { audio: 0.6, video: 0.3, summary: 0.1 };
  const mergedWeights = { ...defaultWeights, ...weights };

  return new EnrichmentProgressTracker(onProgress, mergedWeights);
}
