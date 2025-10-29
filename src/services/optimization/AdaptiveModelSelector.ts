/**
 * Adaptive Model Selection Service (Task 5.11)
 *
 * Automatically chooses the cheapest sufficient model from Claude 4.5 family.
 *
 * Features:
 * - Complexity scoring for tasks
 * - Model selection based on task requirements
 * - Automatic fallback to stronger models on failure
 * - Cost tracking and optimization
 * - Performance monitoring
 *
 * Models (Claude 4.5 Family):
 * - Haiku 4.5: $1.00/1M input, $5.00/1M output (4-5x faster, 90% of Sonnet performance)
 * - Sonnet 4.5: $3.00/1M input, $15.00/1M output (best overall, outperforms Opus in benchmarks)
 * - Opus 4.1: $15.00/1M input, $75.00/1M output (high-stakes only, rarely needed)
 *
 * Target: 40-60% cost reduction, <5% quality degradation, 100% fallback success
 */

import type { Session, SessionScreenshot } from '../../types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type ClaudeModel =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-opus-4-1-20250820';

export interface ModelConfig {
  /** Model identifier */
  model: ClaudeModel;

  /** Input cost per 1M tokens (USD) */
  inputCost: number;

  /** Output cost per 1M tokens (USD) */
  outputCost: number;

  /** Model tier (1=fastest/cheapest, 3=strongest/expensive) */
  tier: 1 | 2 | 3;

  /** Relative performance vs Sonnet (1.0 = equal) */
  relativePerformance: number;

  /** Relative speed vs Sonnet (2.0 = 2x faster) */
  relativeSpeed: number;

  /** Best use cases */
  useCases: string[];

  /** Selection reason */
  reason?: string;
}

export interface TaskComplexity {
  /** Overall complexity score (0-10) */
  score: number;

  /** Factors contributing to complexity */
  factors: {
    /** Input size (tokens, images, audio length) */
    inputSize: number;

    /** Expected output detail */
    outputComplexity: number;

    /** Need for reasoning/analysis depth */
    reasoningDepth: number;

    /** Importance/stakes of accuracy */
    stakes: number;

    /** Time sensitivity (realtime vs batch) */
    timeSensitivity: number;
  };

  /** Reasoning for score */
  reasoning: string;
}

export interface ModelSelectionContext {
  /** Type of AI task */
  taskType:
    | 'screenshot_analysis'
    | 'screenshot_analysis_realtime'
    | 'audio_insights'
    | 'video_chaptering'
    | 'summarization'
    | 'classification'
    | 'critical_reasoning';

  /** Session being processed */
  session?: Session;

  /** Is this a realtime operation? */
  realtime?: boolean;

  /** Estimated input tokens */
  estimatedInputTokens?: number;

  /** Expected output tokens */
  expectedOutputTokens?: number;

  /** Importance level */
  stakes?: 'low' | 'medium' | 'high';

  /** Previous attempts (for fallback) */
  previousAttempts?: Array<{ model: ClaudeModel; success: boolean; error?: string }>;

  /** Maximum cost threshold (USD) */
  maxCost?: number;
}

export interface ModelSelectionResult {
  /** Selected model */
  model: ClaudeModel;

  /** Model configuration */
  config: ModelConfig;

  /** Estimated cost (USD) */
  estimatedCost: number;

  /** Complexity assessment */
  complexity: TaskComplexity;

  /** Whether this is a fallback selection */
  isFallback: boolean;

  /** Confidence in selection (0-1) */
  confidence: number;
}

export interface ModelPerformanceMetrics {
  /** Model ID */
  model: ClaudeModel;

  /** Total uses */
  totalUses: number;

  /** Success rate */
  successRate: number;

  /** Average quality score (0-1) */
  avgQuality: number;

  /** Average cost per task */
  avgCost: number;

  /** Average latency (ms) */
  avgLatency: number;

  /** Fallback rate (how often we had to upgrade) */
  fallbackRate: number;
}

// ============================================================================
// Model Configurations (Claude 4.5 Family)
// ============================================================================

const MODEL_CONFIGS: Record<ClaudeModel, ModelConfig> = {
  'claude-haiku-4-5-20251001': {
    model: 'claude-haiku-4-5-20251001',
    inputCost: 1.0,
    outputCost: 5.0,
    tier: 1,
    relativePerformance: 0.9, // 90% of Sonnet performance
    relativeSpeed: 4.5, // 4-5x faster
    useCases: [
      'Realtime screenshot analysis (speed critical)',
      'Simple classification tasks',
      'Text extraction and parsing',
      'Low-complexity summarization',
      'Batch processing where speed matters',
    ],
  },
  'claude-sonnet-4-5-20250929': {
    model: 'claude-sonnet-4-5-20250929',
    inputCost: 3.0,
    outputCost: 15.0,
    tier: 2,
    relativePerformance: 1.0, // Baseline
    relativeSpeed: 1.0,
    useCases: [
      'Session summarization (best balance)',
      'Deep analysis with nuance',
      'Video chaptering',
      'Audio insights extraction',
      'Complex reasoning tasks',
      'Default for most enrichment',
    ],
  },
  'claude-opus-4-1-20250820': {
    model: 'claude-opus-4-1-20250820',
    inputCost: 15.0,
    outputCost: 75.0,
    tier: 3,
    relativePerformance: 1.05, // Slightly better, but not worth 5x cost for most tasks
    relativeSpeed: 0.7, // Slower
    useCases: [
      'High-stakes critical reasoning (RARE)',
      'Complex multi-step analysis requiring perfect accuracy',
      'NOT RECOMMENDED for session enrichment (Sonnet outperforms in benchmarks)',
    ],
  },
};

// ============================================================================
// Adaptive Model Selector Service
// ============================================================================

export class AdaptiveModelSelector {
  private performanceMetrics: Map<ClaudeModel, ModelPerformanceMetrics> = new Map();
  private selectionHistory: Array<{
    timestamp: string;
    context: ModelSelectionContext;
    result: ModelSelectionResult;
    actualCost?: number;
    success?: boolean;
  }> = [];

  constructor() {
    // Initialize metrics for each model
    Object.keys(MODEL_CONFIGS).forEach((model) => {
      this.performanceMetrics.set(model as ClaudeModel, {
        model: model as ClaudeModel,
        totalUses: 0,
        successRate: 1.0,
        avgQuality: 0.8,
        avgCost: 0,
        avgLatency: 0,
        fallbackRate: 0,
      });
    });
  }

  /**
   * Select optimal model for a task
   *
   * Core selection algorithm:
   * 1. Assess task complexity
   * 2. Match complexity to model tier
   * 3. Apply cost/speed optimizations
   * 4. Consider previous attempts (fallback)
   */
  selectModel(context: ModelSelectionContext): ModelSelectionResult {
    // Step 1: Assess complexity
    const complexity = this.assessComplexity(context);

    // Step 2: Handle fallback if previous attempts failed
    if (context.previousAttempts && context.previousAttempts.length > 0) {
      return this.selectFallbackModel(context, complexity);
    }

    // Step 3: Select based on task type and complexity
    let selectedModel: ClaudeModel;
    let reason: string;

    // High-stakes critical reasoning (RARE) - check this FIRST before complexity scoring
    if (context.taskType === 'critical_reasoning' && context.stakes === 'high') {
      selectedModel = 'claude-opus-4-1-20250820';
      reason = 'High-stakes critical reasoning requires maximum accuracy';
    }
    // Realtime screenshot analysis (speed critical)
    else if (context.taskType === 'screenshot_analysis_realtime' || context.realtime) {
      selectedModel = 'claude-haiku-4-5-20251001';
      reason = '4-5x faster for realtime analysis, 90% of Sonnet performance';
    }
    // Simple classification or low complexity
    else if (context.taskType === 'classification' || complexity.score < 5) {
      selectedModel = 'claude-haiku-4-5-20251001';
      reason = 'Low complexity task, Haiku sufficient and 3x cheaper';
    }
    // Session summarization or medium-high complexity
    else if (context.taskType === 'summarization' || complexity.score >= 5) {
      selectedModel = 'claude-sonnet-4-5-20250929';
      reason = 'Best overall model for complex analysis and summarization';
    }
    // Default: Sonnet 4.5
    else {
      selectedModel = 'claude-sonnet-4-5-20250929';
      reason = 'Default model - best balance of performance and cost';
    }

    // Step 4: Check cost constraint
    const config = { ...MODEL_CONFIGS[selectedModel], reason };
    const estimatedCost = this.estimateCost(
      selectedModel,
      context.estimatedInputTokens || 1000,
      context.expectedOutputTokens || 500
    );

    // If cost exceeds threshold, downgrade to cheaper model
    if (context.maxCost && estimatedCost > context.maxCost) {
      if (selectedModel === 'claude-opus-4-1-20250820') {
        selectedModel = 'claude-sonnet-4-5-20250929';
        reason = 'Downgraded to Sonnet due to cost constraint';
      } else if (selectedModel === 'claude-sonnet-4-5-20250929') {
        selectedModel = 'claude-haiku-4-5-20251001';
        reason = 'Downgraded to Haiku due to cost constraint';
      }
    }

    const result: ModelSelectionResult = {
      model: selectedModel,
      config: { ...MODEL_CONFIGS[selectedModel], reason },
      estimatedCost: this.estimateCost(
        selectedModel,
        context.estimatedInputTokens || 1000,
        context.expectedOutputTokens || 500
      ),
      complexity,
      isFallback: false,
      confidence: this.calculateConfidence(selectedModel, complexity),
    };

    // Track selection
    this.trackSelection(context, result);

    return result;
  }

  /**
   * Select fallback model when previous attempt failed
   */
  private selectFallbackModel(
    context: ModelSelectionContext,
    complexity: TaskComplexity
  ): ModelSelectionResult {
    const previousAttempts = context.previousAttempts || [];
    const lastAttempt = previousAttempts[previousAttempts.length - 1];

    // Upgrade to next tier
    let nextModel: ClaudeModel;
    let reason: string;

    if (lastAttempt.model === 'claude-haiku-4-5-20251001') {
      nextModel = 'claude-sonnet-4-5-20250929';
      reason = 'Fallback from Haiku: Task requires more sophisticated reasoning';
    } else if (lastAttempt.model === 'claude-sonnet-4-5-20250929') {
      nextModel = 'claude-opus-4-1-20250820';
      reason = 'Fallback from Sonnet: Task requires maximum accuracy';
    } else {
      // Already at Opus - can't go higher
      throw new Error(
        'Task failed even with Opus 4.1 - may require different approach or is unsolvable'
      );
    }

    const result: ModelSelectionResult = {
      model: nextModel,
      config: { ...MODEL_CONFIGS[nextModel], reason },
      estimatedCost: this.estimateCost(
        nextModel,
        context.estimatedInputTokens || 1000,
        context.expectedOutputTokens || 500
      ),
      complexity,
      isFallback: true,
      confidence: 0.7, // Lower confidence on fallback
    };

    // Track fallback
    this.trackSelection(context, result);
    this.updateFallbackRate(lastAttempt.model);

    return result;
  }

  /**
   * Assess task complexity (0-10 scale)
   *
   * Factors:
   * - Input size (more data = more complexity)
   * - Output requirements (detail level)
   * - Reasoning depth needed
   * - Stakes (accuracy importance)
   * - Time sensitivity
   */
  assessComplexity(context: ModelSelectionContext): TaskComplexity {
    const factors = {
      inputSize: 0,
      outputComplexity: 0,
      reasoningDepth: 0,
      stakes: 0,
      timeSensitivity: 0,
    };

    // Input size (0-3 scale)
    const inputTokens = context.estimatedInputTokens || 0;
    if (inputTokens < 1000) factors.inputSize = 1;
    else if (inputTokens < 5000) factors.inputSize = 2;
    else factors.inputSize = 3;

    // Output complexity (0-2 scale)
    const outputTokens = context.expectedOutputTokens || 0;
    if (outputTokens < 300) factors.outputComplexity = 1;
    else factors.outputComplexity = 2;

    // Reasoning depth (0-3 scale based on task type)
    if (context.taskType === 'classification') {
      factors.reasoningDepth = 1; // Simple categorization
    } else if (
      context.taskType === 'screenshot_analysis' ||
      context.taskType === 'screenshot_analysis_realtime'
    ) {
      factors.reasoningDepth = 2; // Moderate analysis
    } else if (
      context.taskType === 'summarization' ||
      context.taskType === 'audio_insights' ||
      context.taskType === 'video_chaptering'
    ) {
      factors.reasoningDepth = 3; // Deep synthesis
    } else if (context.taskType === 'critical_reasoning') {
      factors.reasoningDepth = 3; // Maximum reasoning
    }

    // Stakes (0-2 scale)
    if (context.stakes === 'low') factors.stakes = 0;
    else if (context.stakes === 'medium') factors.stakes = 1;
    else if (context.stakes === 'high') factors.stakes = 2;

    // Time sensitivity (0-2 scale)
    if (context.realtime) {
      factors.timeSensitivity = 2; // High - speed critical
    } else if (
      context.taskType === 'screenshot_analysis_realtime' ||
      context.taskType === 'classification'
    ) {
      factors.timeSensitivity = 1; // Medium
    } else {
      factors.timeSensitivity = 0; // Low - batch processing
    }

    // Calculate total score (0-10)
    const score =
      factors.inputSize +
      factors.outputComplexity +
      factors.reasoningDepth +
      factors.stakes +
      (factors.timeSensitivity > 0 ? -1 : 0); // Time sensitivity reduces effective complexity (use faster model)

    // Generate reasoning
    const reasoning = this.generateComplexityReasoning(factors, score);

    return {
      score: Math.max(0, Math.min(10, score)),
      factors,
      reasoning,
    };
  }

  /**
   * Estimate cost for a model and token counts
   */
  estimateCost(model: ClaudeModel, inputTokens: number, outputTokens: number): number {
    const config = MODEL_CONFIGS[model];
    const inputCost = (inputTokens / 1_000_000) * config.inputCost;
    const outputCost = (outputTokens / 1_000_000) * config.outputCost;
    return inputCost + outputCost;
  }

  /**
   * Calculate confidence in model selection (0-1)
   */
  private calculateConfidence(model: ClaudeModel, complexity: TaskComplexity): number {
    const config = MODEL_CONFIGS[model];
    const metrics = this.performanceMetrics.get(model);

    // Base confidence from model tier vs complexity
    let baseConfidence = 0.8;

    // Adjust based on complexity match
    if (complexity.score < 5 && config.tier === 1) {
      baseConfidence = 0.95; // High confidence - good match
    } else if (complexity.score >= 5 && complexity.score < 8 && config.tier === 2) {
      baseConfidence = 0.95; // High confidence - good match
    } else if (complexity.score >= 8 && config.tier === 3) {
      baseConfidence = 0.9; // Good match but Opus rarely needed
    } else if (complexity.score < 5 && config.tier > 1) {
      baseConfidence = 0.7; // Overqualified - could use cheaper
    } else if (complexity.score >= 8 && config.tier < 3) {
      baseConfidence = 0.7; // Underqualified - might need upgrade
    }

    // Adjust based on historical performance
    if (metrics && metrics.totalUses > 10) {
      const performanceBonus = (metrics.successRate - 0.95) * 0.2;
      baseConfidence = Math.min(1, baseConfidence + performanceBonus);
    }

    return baseConfidence;
  }

  /**
   * Track model selection for analytics
   */
  private trackSelection(context: ModelSelectionContext, result: ModelSelectionResult): void {
    this.selectionHistory.push({
      timestamp: new Date().toISOString(),
      context,
      result,
    });

    // Update metrics
    const metrics = this.performanceMetrics.get(result.model);
    if (metrics) {
      metrics.totalUses++;
    }
  }

  /**
   * Update performance metrics after task completion
   */
  updatePerformance(
    model: ClaudeModel,
    actualCost: number,
    success: boolean,
    quality: number,
    latency: number
  ): void {
    const metrics = this.performanceMetrics.get(model);
    if (!metrics) return;

    // Update running averages
    const n = metrics.totalUses;
    metrics.totalUses = n + 1;
    metrics.successRate = (metrics.successRate * n + (success ? 1 : 0)) / (n + 1);
    metrics.avgQuality = (metrics.avgQuality * n + quality) / (n + 1);
    metrics.avgCost = (metrics.avgCost * n + actualCost) / (n + 1);
    metrics.avgLatency = (metrics.avgLatency * n + latency) / (n + 1);
  }

  /**
   * Update fallback rate when a fallback occurs
   */
  private updateFallbackRate(model: ClaudeModel): void {
    const metrics = this.performanceMetrics.get(model);
    if (!metrics) return;

    const n = metrics.totalUses;
    metrics.fallbackRate = (metrics.fallbackRate * n + 1) / (n + 1);
  }

  /**
   * Get performance metrics for a model
   */
  getMetrics(model: ClaudeModel): ModelPerformanceMetrics | undefined {
    return this.performanceMetrics.get(model);
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): ModelPerformanceMetrics[] {
    return Array.from(this.performanceMetrics.values());
  }

  /**
   * Get model configuration
   */
  getModelConfig(model: ClaudeModel): ModelConfig {
    return MODEL_CONFIGS[model];
  }

  /**
   * Calculate cost savings vs always using Sonnet
   */
  calculateSavings(): { totalSaved: number; percentReduction: number } {
    const sonnetConfig = MODEL_CONFIGS['claude-sonnet-4-5-20250929'];
    let actualCost = 0;
    let sonnetCost = 0;

    this.selectionHistory.forEach((entry) => {
      if (entry.actualCost !== undefined) {
        actualCost += entry.actualCost;

        // Calculate what it would have cost with Sonnet
        const inputTokens = entry.context.estimatedInputTokens || 1000;
        const outputTokens = entry.context.expectedOutputTokens || 500;
        sonnetCost += this.estimateCost('claude-sonnet-4-5-20250929', inputTokens, outputTokens);
      }
    });

    const saved = sonnetCost - actualCost;
    const percentReduction = sonnetCost > 0 ? (saved / sonnetCost) * 100 : 0;

    return { totalSaved: saved, percentReduction };
  }

  /**
   * Generate human-readable complexity reasoning
   */
  private generateComplexityReasoning(factors: TaskComplexity['factors'], score: number): string {
    const parts: string[] = [];

    if (factors.inputSize === 3) {
      parts.push('large input size');
    } else if (factors.inputSize === 2) {
      parts.push('moderate input');
    }

    if (factors.reasoningDepth === 3) {
      parts.push('deep reasoning required');
    } else if (factors.reasoningDepth === 2) {
      parts.push('moderate analysis needed');
    }

    if (factors.stakes === 2) {
      parts.push('high accuracy stakes');
    }

    if (factors.timeSensitivity === 2) {
      parts.push('realtime speed critical');
    }

    if (parts.length === 0) {
      return 'Simple task with minimal complexity';
    }

    return `Complexity ${score}/10: ${parts.join(', ')}`;
  }
}

/**
 * Export singleton instance
 */
export const adaptiveModelSelector = new AdaptiveModelSelector();
