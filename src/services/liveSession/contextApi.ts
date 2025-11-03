/**
 * Live Session Context API
 *
 * Simple functions to get session context for external AI services.
 * Wraps LiveSessionContextBuilder with a clean API.
 *
 * Usage:
 * ```typescript
 * import { getSessionContext } from './contextApi';
 *
 * // Get summary context (lightweight)
 * const context = await getSessionContext(sessionId, 'summary');
 *
 * // Get delta (what changed)
 * const delta = await getSessionContext(sessionId, 'delta', lastUpdateTime);
 * ```
 */

import {
  LiveSessionContextBuilder,
  type SummaryContext,
  type FullContext,
  type DeltaContext
} from './contextBuilder';

// Re-export types for convenience
export type { SummaryContext, FullContext, DeltaContext };

// Singleton instance
let contextBuilder: LiveSessionContextBuilder | null = null;

/**
 * Get context builder instance (singleton)
 */
function getContextBuilder(): LiveSessionContextBuilder {
  if (!contextBuilder) {
    contextBuilder = new LiveSessionContextBuilder();
  }
  return contextBuilder;
}

// ============================================================================
// Main Context API
// ============================================================================

/**
 * Get session context for AI
 *
 * Choose context type based on your needs:
 * - 'summary': Lightweight (~2-5 KB) - for quick AI calls
 * - 'full': Comprehensive (~50-200 KB) - for deep analysis
 * - 'delta': Changes only (~1-10 KB) - for incremental updates
 *
 * @param sessionId - Session ID
 * @param contextType - Type of context to build
 * @param since - For 'delta' type: ISO 8601 timestamp of last update
 * @returns Session context
 *
 * @example
 * ```typescript
 * // Get lightweight context for quick AI call
 * const context = await getSessionContext(sessionId, 'summary');
 *
 * // Get comprehensive context for deep analysis
 * const fullContext = await getSessionContext(sessionId, 'full');
 *
 * // Get only what changed since last update
 * const delta = await getSessionContext(sessionId, 'delta', lastUpdateTime);
 * ```
 */
export async function getSessionContext(
  sessionId: string,
  contextType: 'summary',
  since?: never
): Promise<SummaryContext>;

export async function getSessionContext(
  sessionId: string,
  contextType: 'full',
  since?: never
): Promise<FullContext>;

export async function getSessionContext(
  sessionId: string,
  contextType: 'delta',
  since: string
): Promise<DeltaContext>;

export async function getSessionContext(
  sessionId: string,
  contextType: 'summary' | 'full' | 'delta',
  since?: string
): Promise<SummaryContext | FullContext | DeltaContext> {
  const builder = getContextBuilder();

  if (contextType === 'summary') {
    return await builder.buildSummaryContext(sessionId);
  } else if (contextType === 'full') {
    return await builder.buildFullContext(sessionId);
  } else if (contextType === 'delta') {
    if (!since) {
      throw new Error('Delta context requires "since" timestamp');
    }
    return await builder.buildDeltaContext(sessionId, since);
  }

  throw new Error(`Invalid context type: ${contextType}`);
}

/**
 * Get recommended context type
 *
 * Automatically chooses the best context type based on:
 * - Session status (active vs completed)
 * - Time since last update
 * - Change rate
 *
 * @param sessionId - Session ID
 * @param lastUpdateTime - When AI last updated (optional)
 * @returns Recommended context type
 *
 * @example
 * ```typescript
 * const contextType = await getRecommendedContextType(sessionId, lastUpdateTime);
 * const context = await getSessionContext(sessionId, contextType);
 * ```
 */
export async function getRecommendedContextType(
  sessionId: string,
  lastUpdateTime?: string
): Promise<'summary' | 'full' | 'delta'> {
  const builder = getContextBuilder();
  return await builder.getRecommendedContextType(sessionId, lastUpdateTime);
}

/**
 * Estimate context size
 *
 * Useful for choosing context type based on budget/token limits.
 *
 * @param sessionId - Session ID
 * @param contextType - Type to estimate
 * @param since - For 'delta': timestamp
 * @returns Estimated size in bytes
 *
 * @example
 * ```typescript
 * const summarySize = await estimateContextSize(sessionId, 'summary');
 * const fullSize = await estimateContextSize(sessionId, 'full');
 *
 * if (fullSize > 100000) {
 *   // Use summary instead
 *   const context = await getSessionContext(sessionId, 'summary');
 * }
 * ```
 */
export async function estimateContextSize(
  sessionId: string,
  contextType: 'summary' | 'full' | 'delta',
  since?: string
): Promise<number> {
  const builder = getContextBuilder();
  return await builder.estimateContextSize(contextType, sessionId, since);
}

/**
 * Smart context getter
 *
 * Automatically chooses context type and returns appropriate context.
 * Uses heuristics to balance cost vs. completeness.
 *
 * @param sessionId - Session ID
 * @param lastUpdateTime - When AI last updated (optional)
 * @returns Context (type determined automatically)
 *
 * @example
 * ```typescript
 * // First update
 * const context1 = await getSmartContext(sessionId);
 * // Returns summary context
 *
 * // Update 2 minutes later
 * const context2 = await getSmartContext(sessionId, previousUpdateTime);
 * // Returns delta context (only changes)
 *
 * // Update after session ends
 * const context3 = await getSmartContext(sessionId, previousUpdateTime);
 * // Returns full context (for final summary)
 * ```
 */
export async function getSmartContext(
  sessionId: string,
  lastUpdateTime?: string
): Promise<{
  contextType: 'summary' | 'full' | 'delta';
  context: SummaryContext | FullContext | DeltaContext;
  sizeBytes: number;
}> {
  const contextType = await getRecommendedContextType(sessionId, lastUpdateTime);

  let context: SummaryContext | FullContext | DeltaContext;

  if (contextType === 'delta' && lastUpdateTime) {
    context = await getSessionContext(sessionId, 'delta', lastUpdateTime);
  } else if (contextType === 'full') {
    context = await getSessionContext(sessionId, 'full');
  } else {
    context = await getSessionContext(sessionId, 'summary');
  }

  const sizeBytes = JSON.stringify(context).length;

  return {
    contextType,
    context,
    sizeBytes
  };
}
