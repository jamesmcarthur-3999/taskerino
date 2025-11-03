/**
 * AI Tools - Shared Types
 *
 * Type definitions for all AI agent tools.
 * These types ensure consistency across data gathering, transcript correction,
 * enrichment, and suggestion systems.
 */

import type { Session, SessionScreenshot, SessionAudioSegment, Task, Note } from '../../types';

// =============================================================================
// TOOL EXECUTION TYPES
// =============================================================================

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: ToolExecutionError;
  metadata?: {
    executionTime?: number;
    cacheHit?: boolean;
    [key: string]: any;
  };
}

/**
 * Structured error for tool execution failures
 */
export class ToolExecutionError extends Error {
  constructor(
    public userMessage: string,
    public backendDetails: {
      error: string;
      code?: string;
      stack?: string;
      context?: Record<string, any>;
    }
  ) {
    super(userMessage);
    this.name = 'ToolExecutionError';
  }
}

// =============================================================================
// SOURCE CONTEXT (For Entity Creation)
// =============================================================================

/**
 * Source context for tasks/notes created from session data
 */
export type SourceContext = {
  type: 'screenshot' | 'audio' | 'video_frame' | 'manual';
  session_id?: string;
  screenshot_id?: string;
  audio_segment_id?: string;
  video_timestamp?: number;
  excerpt?: string; // Spoken words, OCR text, etc.
};

// =============================================================================
// DATA GATHERING TYPES
// =============================================================================

/**
 * Audio data retrieval modes
 */
export type AudioDataMode = 'segment' | 'time_range' | 'full_session';

/**
 * Input for getAudioData tool
 */
export interface GetAudioDataInput {
  mode: AudioDataMode;
  session_id: string;

  // For mode: 'segment'
  segment_id?: string;

  // For mode: 'time_range'
  start_time?: number; // Seconds from session start
  end_time?: number;

  // Common options
  format?: 'wav' | 'mp3';
  include_waveform?: boolean;
}

/**
 * Output from getAudioData tool
 */
export interface GetAudioDataOutput {
  audio_base64: string;
  format: 'wav' | 'mp3';
  duration: number;
  sample_rate?: number;
  channels?: number;
  waveform_data?: number[]; // Optional visual waveform
  segments?: SessionAudioSegment[]; // Metadata for included segments
}

/**
 * Video data retrieval modes
 */
export type VideoDataMode = 'frames_at_timestamps' | 'frames_by_interval' | 'metadata';

/**
 * Input for getVideoData tool
 */
export interface GetVideoDataInput {
  mode: VideoDataMode;
  session_id: string;

  // For mode: 'frames_at_timestamps'
  timestamps?: number[]; // Array of seconds from session start

  // For mode: 'frames_by_interval'
  interval_seconds?: number;

  // Common options
  max_frames?: number; // Prevent overload
}

/**
 * Output from getVideoData tool
 */
export interface GetVideoDataOutput {
  frames?: Array<{
    timestamp: number;
    data_uri: string; // Base64 PNG
    width: number;
    height: number;
  }>;
  metadata?: {
    duration: number;
    width: number;
    height: number;
    codec?: string;
    file_size?: number;
    path?: string;
  };
}

/**
 * Transcript retrieval modes
 */
export type TranscriptMode = 'segments' | 'full_transcript';

/**
 * Input for getTranscript tool
 */
export interface GetTranscriptInput {
  mode: TranscriptMode;
  session_id: string;

  // For mode: 'segments'
  start_time?: number;
  end_time?: number;
  quality_filter?: 'draft' | 'final' | 'all';

  // For mode: 'full_transcript'
  format?: 'plain' | 'srt' | 'vtt' | 'json';
  quality?: 'draft' | 'final' | 'best'; // best = prefer final, fallback to draft
}

/**
 * Output from getTranscript tool
 */
export interface GetTranscriptOutput {
  // For mode: 'segments'
  segments?: SessionAudioSegment[];

  // For mode: 'full_transcript'
  transcript?: string;
  format?: string;

  // Metadata
  total_duration?: number;
  word_count?: number;
  segment_count?: number;
}

/**
 * Input for getSessionTimeline tool
 */
export interface GetSessionTimelineInput {
  session_id: string;
  include_screenshots?: boolean;
  include_audio?: boolean;
  include_achievements?: boolean;
  include_blockers?: boolean;
  start_time?: number;
  end_time?: number;
}

/**
 * Timeline item (screenshot or audio event)
 */
export interface TimelineItem {
  type: 'screenshot' | 'audio' | 'achievement' | 'blocker';
  timestamp: string; // ISO timestamp
  relative_time: number; // Seconds from session start
  data: SessionScreenshot | SessionAudioSegment | { description: string };
}

/**
 * Output from getSessionTimeline tool
 */
export interface GetSessionTimelineOutput {
  timeline: TimelineItem[];
  session_duration: number;
  item_count: number;
}

// =============================================================================
// TRANSCRIPT CORRECTION TYPES
// =============================================================================

/**
 * Transcript update modes
 */
export type TranscriptUpdateMode =
  | 'single_segment'
  | 'batch_segments'
  | 're_transcribe_segment'
  | 're_transcribe_range'
  | 'upgrade_all';

/**
 * Input for updateTranscript tool
 */
export interface UpdateTranscriptInput {
  mode: TranscriptUpdateMode;

  // For mode: 'single_segment'
  segment_id?: string;
  corrected_transcription?: string;
  correction_reason?: string;
  confidence?: number; // 0-1

  // For mode: 'batch_segments'
  batch_updates?: Array<{
    segment_id: string;
    corrected_transcription: string;
    correction_reason: string;
    confidence: number;
  }>;

  // For mode: 're_transcribe_segment'
  // segment_id required, reason required
  reason?: string;

  // For mode: 're_transcribe_range'
  session_id?: string;
  start_time?: number;
  end_time?: number;

  // For mode: 'upgrade_all'
  // session_id required
  force?: boolean; // Skip needsUpgrade check
}

/**
 * Output from updateTranscript tool
 */
export interface UpdateTranscriptOutput {
  updated_segments: SessionAudioSegment[];
  update_count: number;
  errors?: Array<{
    segment_id: string;
    error: string;
  }>;
}

// =============================================================================
// ENRICHMENT TYPES
// =============================================================================

/**
 * Analysis update modes
 */
export type AnalysisUpdateMode = 'screenshot' | 'audio_segment' | 'session_summary' | 'audio_insights';

/**
 * Input for updateAnalysis tool
 */
export interface UpdateAnalysisInput {
  mode: AnalysisUpdateMode;
  session_id: string; // Required for all modes

  // For mode: 'screenshot'
  screenshot_id?: string;
  analysis?: any; // Partial of screenshot aiAnalysis

  // For mode: 'audio_segment'
  segment_id?: string;
  segment_metadata?: {
    keyPhrases?: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    containsTask?: boolean;
    containsBlocker?: boolean;
    [key: string]: any; // Allow additional fields
  };

  // For mode: 'session_summary'
  summary?: any; // Partial<SessionSummary>

  // For mode: 'audio_insights'
  audio_insights?: any; // Partial<AudioInsights>
}

/**
 * Output from updateAnalysis tool
 */
export interface UpdateAnalysisOutput {
  updated_screenshot?: SessionScreenshot;
  updated_segment?: SessionAudioSegment;
  updated_summary?: any; // SessionSummary
  updated_audio_insights?: any; // AudioInsights
}

/**
 * Input for updateSessionMetadata tool
 */
export interface UpdateSessionMetadataInput {
  session_id: string;

  // Basic fields
  metadata_updates?: {
    name?: string;
    description?: string;
    tags?: string[];
    category?: string;
    subCategory?: string;
    activityType?: string;
  };

  // Screenshot operations
  screenshot_operations?: Array<{
    screenshot_id: string;
    operation: 'flag' | 'unflag' | 'add_comment';
    value?: boolean | string;
  }>;

  reason: string;
}

/**
 * Output from updateSessionMetadata tool
 */
export interface UpdateSessionMetadataOutput {
  success: boolean;
  session_id: string;
  fields_updated: string[];
}

// =============================================================================
// SUGGESTION SYSTEM TYPES
// =============================================================================

/**
 * Entity type for suggestions
 */
export type SuggestionEntityType = 'task' | 'note';

/**
 * AI-generated entity suggestion
 */
export interface EntitySuggestion {
  id: string;
  type: 'task' | 'note';
  status: 'pending' | 'approved' | 'rejected';
  confidence: number; // 0-1
  reasoning?: string;
  source_context?: SourceContext;
  suggested_content: {
    title?: string;
    description?: string;
    content?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    tags?: string[];
    dueDate?: string;
    [key: string]: any;
  };
  created_at: string;
  created_by: 'ai' | 'user';
  reviewed_at?: string;
  entity_id?: string; // If approved and created
}

/**
 * Single suggestion input
 */
export interface SingleSuggestionInput {
  type?: 'task' | 'note';
  title: string;
  description?: string;
  content?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  due_date?: string;
  confidence: number;
  reasoning?: string;
  source_context?: SourceContext;
}

/**
 * Input for suggestEntity tool
 */
export interface SuggestEntityInput {
  mode: 'task' | 'note' | 'batch';

  // For mode: 'task' or 'note'
  suggestion?: SingleSuggestionInput;

  // For mode: 'batch'
  suggestions?: SingleSuggestionInput[];
}

/**
 * Output from suggestEntity tool
 */
export interface SuggestEntityOutput {
  suggestion_id?: string;
  suggestion?: EntitySuggestion;
  suggestions?: EntitySuggestion[];
  errors?: Array<{ index: number; error: string }>;
}

/**
 * Input for createFromSuggestion tool
 */
export interface CreateFromSuggestionInput {
  suggestion_id: string;
  session_id: string;
  approved: boolean;

  // Optional modifications to suggestion data
  task_modifications?: Partial<TaskSuggestionData>;
  note_modifications?: Partial<NoteSuggestionData>;
}

/**
 * Output from createFromSuggestion tool
 */
export interface CreateFromSuggestionOutput {
  success: boolean;
  entity_type: SuggestionEntityType;
  entity_id?: string; // Created task/note ID
  entity?: Task | Note;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Audio format validation
 */
export type AudioFormat = 'wav' | 'mp3';

/**
 * Video format validation
 */
export type VideoFormat = 'mp4' | 'mov';

/**
 * Transcript format validation
 */
export type TranscriptFormat = 'plain' | 'srt' | 'vtt' | 'json';
