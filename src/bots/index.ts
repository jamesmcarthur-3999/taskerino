// Configuration
export { initializeBots, updateApiKeys, isBotsReady, MODELS } from './config';
export type { BotConfig } from './config';

// Type definitions
export * from './types';

// Bots
export { screenshotAnalyzer, analyzeScreenshot, clearScreenshotContext } from './screenshot-analyzer';
export { sessionSummarizer, summarizeSession } from './session-summarizer';
export {
  audioReviewer,
  reviewAudio,
  reviewAudioChunked,
  estimateAudioReviewCost
} from './audio-reviewer';
export { createCaptureProcessor, processCapture } from './capture-processor';
export {
  contextSearcher,
  searchContext,
  clearSearchThread,
  createSearchThread
} from './context-searcher';
export {
  sessionSearcher,
  searchSessions,
  clearSessionSearchThread,
  createSessionSearchThread
} from './session-searcher';

// Tools
export * from './tools';

// Ned Assistant
export {
  createNedAssistant,
  initializeNed,
  sendMessageToNed,
  askNed,
  createConversation,
  clearConversation,
} from './ned-assistant';
export type { NedConfig, NedStreamHandler } from './ned-assistant';
