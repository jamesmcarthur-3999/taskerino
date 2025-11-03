/**
 * AI Tools - Comprehensive tool system for AI agents
 *
 * This module provides a complete set of tools for AI agents to:
 * - Gather session data (audio, video, transcripts, timelines)
 * - Correct and upgrade transcripts
 * - Update and enrich analysis
 * - Create entity suggestions
 *
 * Usage contexts:
 * - Enrichment: No permission required (user already confirmed)
 * - Live Session: No permission required (auto-analysis enabled)
 * - Chat (Ned): Requires permission
 *
 * See README.md for complete documentation.
 */

// ====================
// Data Gathering Tools
// ====================

export {
  getAudioData,
  getVideoData,
  getTranscript,
  getSessionTimeline
} from './data-gathering';

export type {
  GetAudioDataInput,
  GetAudioDataOutput,
  GetVideoDataInput,
  GetVideoDataOutput,
  GetTranscriptInput,
  GetTranscriptOutput,
  GetSessionTimelineInput,
  GetSessionTimelineOutput
} from './types';

// =========================
// Transcript Correction Tools
// =========================

export { updateTranscript } from './transcript-correction';

export type {
  UpdateTranscriptInput,
  UpdateTranscriptOutput
} from './types';

// =================
// Enrichment Tools
// =================

export { updateAnalysis } from './enrichment';

export type {
  UpdateAnalysisInput,
  UpdateAnalysisOutput
} from './types';

// =================
// Suggestion Tools
// =================

export {
  suggestEntity,
  loadPendingSuggestions,
  getSuggestion,
  updateSuggestionStatus,
  deleteSuggestion
} from './suggestions';

export type {
  SuggestEntityInput,
  SuggestEntityOutput,
  EntitySuggestion
} from './types';

// =============
// Common Types
// =============

export type {
  ToolExecutionResult,
  ToolExecutionError,
  SourceContext,
  TimelineItem
} from './types';

export { ToolExecutionError as ToolError } from './types';

// ===========
// Utilities
// ===========

export * from './utils';
