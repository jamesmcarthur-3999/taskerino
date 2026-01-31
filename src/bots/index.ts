/**
 * Baleybots Integration for Taskerino
 *
 * This module provides unified AI functionality using the Baleybots SDK.
 * It replaces the previous fragmented AI services with type-safe,
 * composable bot implementations.
 *
 * @example
 * ```typescript
 * import { initializeBots, useNed, processCapture } from './bots';
 *
 * // Initialize on app startup
 * await initializeBots();
 *
 * // Use Ned assistant
 * const { messages, sendMessage } = useNed({ config, dispatch });
 * await sendMessage('Create a task for tomorrow');
 *
 * // Process user input
 * const result = await processCapture(text, topics, notes, tasks);
 * ```
 */

// Configuration
export { initializeBots, updateApiKeys, isBotsReady, MODELS } from './config';
export type { BotConfig } from './config';

// Type definitions
export * from './types';

// Core bots
export { screenshotAnalyzer, analyzeScreenshot, clearScreenshotContext } from './screenshot-analyzer';
export { sessionSummarizer, summarizeSession } from './session-summarizer';
export { audioReviewer, reviewAudio, reviewAudioChunked, estimateAudioReviewCost } from './audio-reviewer';
export { createCaptureProcessor, processCapture } from './capture-processor';
export { contextSearcher, searchContext, clearSearchThread, createSearchThread } from './context-searcher';
export { sessionSearcher, searchSessions, clearSessionSearchThread, createSessionSearchThread } from './session-searcher';

// Ned assistant
export {
  createNedAssistant,
  initializeNed,
  sendMessageToNed,
  askNed,
  createConversation,
  clearConversation,
} from './ned-assistant';
export type { NedConfig, NedStreamHandler } from './ned-assistant';

// Tools
export * from './tools';

// React hooks
export * from './hooks';

// Adapters (for migration)
export * from './adapters';
