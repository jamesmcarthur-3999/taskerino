/**
 * Enrichment Orchestrator
 *
 * Strategy selector and factory for enrichment implementations.
 * Provides seamless switching between legacy and AI agent strategies.
 */

import type { Session } from '../../types';
import type {
  EnrichmentStrategy,
  StrategyConfig,
  EnrichmentOptions,
  EnrichmentResult
} from './strategies/EnrichmentStrategy';

// =============================================================================
// ORCHESTRATOR
// =============================================================================

/**
 * EnrichmentOrchestrator
 *
 * Manages strategy selection and execution based on configuration.
 * Provides unified API regardless of underlying implementation.
 *
 * @example
 * ```typescript
 * const orchestrator = new EnrichmentOrchestrator({
 *   strategy: 'ai-agent',
 *   aiAgent: { enableStreaming: true }
 * });
 *
 * const result = await orchestrator.enrichSession(session, options);
 * ```
 */
export class EnrichmentOrchestrator {
  private strategy: EnrichmentStrategy;
  private config: StrategyConfig;

  constructor(config: StrategyConfig) {
    this.config = config;
    this.strategy = this.createStrategy(config);
  }

  /**
   * Create enrichment strategy based on configuration
   */
  private createStrategy(config: StrategyConfig): EnrichmentStrategy {
    switch (config.strategy) {
      case 'legacy':
        // Lazy load to avoid circular dependencies
        const { LegacyEnrichmentStrategy } = require('./strategies/LegacyEnrichmentStrategy');
        return new LegacyEnrichmentStrategy(config.legacy);

      case 'ai-agent':
        // Lazy load to avoid circular dependencies
        const { AIAgentEnrichmentStrategy } = require('./strategies/AIAgentEnrichmentStrategy');
        return new AIAgentEnrichmentStrategy(config.aiAgent);

      default:
        throw new Error(`Unknown enrichment strategy: ${config.strategy}`);
    }
  }

  /**
   * Switch to a different strategy at runtime
   *
   * @param config - New strategy configuration
   */
  switchStrategy(config: StrategyConfig): void {
    this.config = config;
    this.strategy = this.createStrategy(config);
  }

  /**
   * Get current strategy name
   */
  getStrategyName(): 'legacy' | 'ai-agent' {
    return this.strategy.name;
  }

  /**
   * Get current strategy configuration
   */
  getConfig(): StrategyConfig {
    return this.config;
  }

  // =============================================================================
  // DELEGATE TO STRATEGY
  // =============================================================================

  /**
   * Enrich a session using callback-based progress updates
   */
  async enrichSession(
    session: Session,
    options?: EnrichmentOptions
  ): Promise<EnrichmentResult> {
    return this.strategy.enrichSession(session, options);
  }

  /**
   * Enrich a session with streaming progress updates
   */
  enrichSessionStreaming(
    session: Session,
    options?: Omit<EnrichmentOptions, 'onProgress'>
  ): AsyncGenerator<any, void, unknown> {
    return this.strategy.enrichSessionStreaming(session, options);
  }

  /**
   * Estimate enrichment cost before execution
   */
  async estimateCost(
    session: Session,
    options?: EnrichmentOptions
  ): Promise<number> {
    return this.strategy.estimateCost(session, options);
  }

  /**
   * Validate session is ready for enrichment
   */
  async validateSession(session: Session): Promise<{
    valid: boolean;
    errors: string[];
    warnings?: string[];
  }> {
    return this.strategy.validateSession(session);
  }

  /**
   * Cancel ongoing enrichment
   */
  async cancelEnrichment(sessionId: string): Promise<boolean> {
    return this.strategy.cancelEnrichment(sessionId);
  }

  /**
   * Check if strategy supports a specific feature
   */
  supportsFeature(feature: string): boolean {
    return this.strategy.supportsFeature(feature as any);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let globalOrchestrator: EnrichmentOrchestrator | null = null;

/**
 * Get or create global enrichment orchestrator
 *
 * @param config - Optional configuration (uses default if not provided)
 * @returns Global orchestrator instance
 */
export function getEnrichmentOrchestrator(
  config?: StrategyConfig
): EnrichmentOrchestrator {
  if (!globalOrchestrator) {
    // Default to legacy strategy for backward compatibility
    const defaultConfig: StrategyConfig = config || {
      strategy: 'legacy',
      legacy: {
        enableIncremental: true,
        enableCaching: true
      }
    };
    globalOrchestrator = new EnrichmentOrchestrator(defaultConfig);
  } else if (config) {
    // Update strategy if new config provided
    globalOrchestrator.switchStrategy(config);
  }

  return globalOrchestrator;
}

/**
 * Reset global orchestrator (useful for testing)
 */
export function resetEnrichmentOrchestrator(): void {
  globalOrchestrator = null;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Enrich a session using the global orchestrator
 *
 * Convenience function for direct enrichment without managing orchestrator instance.
 *
 * @example
 * ```typescript
 * import { enrichSession } from '@/services/enrichment/EnrichmentOrchestrator';
 *
 * const result = await enrichSession(session, {
 *   onProgress: (progress) => console.log(progress.message)
 * });
 * ```
 */
export async function enrichSession(
  session: Session,
  options?: EnrichmentOptions
): Promise<EnrichmentResult> {
  const orchestrator = getEnrichmentOrchestrator();
  return orchestrator.enrichSession(session, options);
}

/**
 * Enrich a session with streaming updates using the global orchestrator
 *
 * @example
 * ```typescript
 * import { enrichSessionStreaming } from '@/services/enrichment/EnrichmentOrchestrator';
 *
 * for await (const update of enrichSessionStreaming(session, options)) {
 *   if ('success' in update) {
 *     console.log('Complete:', update.success);
 *   } else {
 *     console.log('Progress:', update.progress);
 *   }
 * }
 * ```
 */
export function enrichSessionStreaming(
  session: Session,
  options?: Omit<EnrichmentOptions, 'onProgress'>
): AsyncGenerator<any, void, unknown> {
  const orchestrator = getEnrichmentOrchestrator();
  return orchestrator.enrichSessionStreaming(session, options);
}
