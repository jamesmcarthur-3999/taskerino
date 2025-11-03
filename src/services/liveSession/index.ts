/**
 * Live Session Intelligence Infrastructure
 *
 * Main entry point for external AI services to integrate with Taskerino's
 * live session system. Provides tools, event infrastructure, and context APIs.
 *
 * Usage:
 * ```typescript
 * import {
 *   getLiveSessionTools,
 *   LiveSessionToolExecutor,
 *   LIVE_SESSION_TOOLS
 * } from './services/liveSession';
 *
 * // Get tools for your AI
 * const { schemas, executor } = getLiveSessionTools(activeSession);
 *
 * // Execute tools
 * const results = await executor.executeTools(toolCalls);
 * ```
 */

import type { Session } from '../../types';
import { LIVE_SESSION_TOOLS, type ToolSchema } from './toolSchemas';
import { LiveSessionToolExecutor, type ToolCall, type ToolResult } from './toolExecutor';

// Re-export types for convenience
export type { ToolSchema, ToolCall, ToolResult };
export type { TaskSuggestion, NoteSuggestion } from './toolExecutor';

// Re-export tool schemas
export { LIVE_SESSION_TOOLS, getToolSchema, getToolNames } from './toolSchemas';

// Re-export tool executor
export { LiveSessionToolExecutor } from './toolExecutor';

// ============================================================================
// Main API
// ============================================================================

/**
 * Tool registry (schemas + executor)
 */
export interface LiveSessionToolRegistry {
  /** Tool schemas (pass to AI service) */
  schemas: ToolSchema[];

  /** Tool executor (execute tool calls from AI) */
  executor: LiveSessionToolExecutor;
}

/**
 * Get live session tools for external AI integration
 *
 * This is the main entry point for integrating external AI services.
 *
 * @param session - Active session (optional, can be set later via executor.setActiveSession())
 * @returns Tool registry with schemas and executor
 *
 * @example
 * ```typescript
 * // Get tools for active session
 * const { schemas, executor } = getLiveSessionTools(activeSession);
 *
 * // Pass schemas to your AI service
 * const aiResponse = await yourAI.chat({
 *   messages: [...],
 *   tools: schemas
 * });
 *
 * // Execute any tool calls from AI
 * if (aiResponse.tool_calls) {
 *   const results = await executor.executeTools(aiResponse.tool_calls);
 * }
 * ```
 */
export function getLiveSessionTools(session?: Session): LiveSessionToolRegistry {
  return {
    schemas: LIVE_SESSION_TOOLS,
    executor: new LiveSessionToolExecutor(session)
  };
}

/**
 * Get tool names (for debugging/logging)
 *
 * @returns Array of tool names
 *
 * @example
 * ```typescript
 * const toolNames = getLiveSessionToolNames();
 * console.log(`Available tools: ${toolNames.join(', ')}`);
 * ```
 */
export function getLiveSessionToolNames(): string[] {
  return LIVE_SESSION_TOOLS.map(tool => tool.name);
}

/**
 * Validate tool call
 *
 * Checks if a tool call has valid name and input structure.
 * Useful for debugging before executing tools.
 *
 * @param toolCall - Tool call to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const validation = validateToolCall(toolCall);
 * if (!validation.valid) {
 *   console.error(`Invalid tool call: ${validation.error}`);
 * }
 * ```
 */
export function validateToolCall(toolCall: ToolCall): {
  valid: boolean;
  error?: string;
} {
  // Check tool exists
  const schema = LIVE_SESSION_TOOLS.find(t => t.name === toolCall.name);
  if (!schema) {
    return {
      valid: false,
      error: `Unknown tool: ${toolCall.name}`
    };
  }

  // Check required fields
  const required = schema.input_schema.required || [];
  for (const field of required) {
    if (!(field in toolCall.input)) {
      return {
        valid: false,
        error: `Missing required field: ${field}`
      };
    }
  }

  return { valid: true };
}
