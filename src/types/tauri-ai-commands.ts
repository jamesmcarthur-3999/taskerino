// TypeScript type definitions for Tauri AI API commands
// Generated from Rust types in src-tauri/src/ai_types.rs

// ============================================================================
// OpenAI Types
// ============================================================================

/**
 * Represents a single word in a Whisper transcription with timing information.
 */
export interface WhisperWord {
  /** The transcribed word */
  word: string;
  /** Start time of the word in seconds */
  start: number;
  /** End time of the word in seconds */
  end: number;
}

/**
 * Response from OpenAI Whisper transcription API.
 */
export interface WhisperTranscriptionResponse {
  /** The full transcribed text */
  text: string;
  /** Optional array of individual words with timing information */
  words?: WhisperWord[];
}

/**
 * Context information about an audio recording session.
 */
export interface AudioAnalysisContext {
  /** Name of the recording session */
  sessionName?: string;
  /** Description of the recording session */
  sessionDescription?: string;
  /** Duration of the audio in seconds */
  duration?: number;
  /** Number of screenshots captured during the session */
  screenshotCount?: number;
  /** Number of audio segments in the session */
  segmentCount?: number;
}

/**
 * Represents a significant moment in the audio analysis.
 */
export interface KeyMoment {
  /** Timestamp of the moment in seconds (floating point for sub-second precision) */
  timestamp: number;
  /** Type of moment (e.g., "achievement", "blocker", "decision", "insight") */
  type: string;
  /** Description of what happened at this moment */
  description: string;
  /** Surrounding context for this moment */
  context: string;
  /** Brief quote or excerpt from the audio */
  excerpt: string;
}

/**
 * Represents a period of focused work.
 */
export interface FlowState {
  /** Start time in seconds (floating point for sub-second precision) */
  start: number;
  /** End time in seconds (floating point for sub-second precision) */
  end: number;
  /** Description of the flow state */
  description: string;
}

/**
 * Analysis of work patterns detected in the audio.
 */
export interface WorkPatterns {
  /** Overall focus level during the session (e.g., "low", "medium", "high") */
  focusLevel: string;
  /** Number of interruptions detected */
  interruptions: number;
  /** Periods of focused work (flow states) */
  flowStates: FlowState[];
}

/**
 * Environmental context derived from audio analysis.
 */
export interface EnvironmentalContext {
  /** Description of ambient noise and background sounds */
  ambientNoise: string;
  /** Description of the work setting/environment */
  workSetting: string;
  /** Estimated time of day based on context */
  timeOfDay: string;
}

/**
 * Comprehensive insights derived from audio analysis.
 */
export interface AudioInsights {
  /** Narrative summary of the audio session */
  narrative: string;
  /** Detected emotional states throughout the session */
  emotionalJourney: string[];
  /** Significant moments identified in the audio */
  keyMoments: KeyMoment[];
  /** Work patterns analysis */
  workPatterns: WorkPatterns;
  /** Environmental context analysis */
  environmentalContext: EnvironmentalContext;
}

/**
 * Complete response from audio analysis including transcription and insights.
 */
export interface AudioAnalysisResponse {
  /** The full transcribed text */
  transcription: string;
  /** Analyzed insights from the audio */
  insights: AudioInsights;
}

// ============================================================================
// Claude Types
// ============================================================================

/**
 * Image source for Claude API with base64-encoded data.
 */
export interface ClaudeImageSource {
  /** Source type, typically "base64" */
  type: string;
  /** Media type (e.g., "image/jpeg", "image/png") */
  mediaType: string;
  /** Base64-encoded image data */
  data: string;
}

/**
 * Content block in a Claude message - can be text, image, tool use, or tool result.
 */
export type ClaudeContentBlock =
  | {
      type: "text";
      text: string;
      cache_control?: {
        type: "ephemeral";
      };
    }
  | {
      type: "image";
      source: ClaudeImageSource;
      cache_control?: {
        type: "ephemeral";
      };
    }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, any>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

/**
 * Content of a Claude message - can be a simple string or array of content blocks.
 */
export type ClaudeMessageContent = string | ClaudeContentBlock[];

/**
 * A message in a Claude conversation.
 */
export interface ClaudeMessage {
  /** Role of the message sender ("user" or "assistant") */
  role: string;
  /** Content of the message */
  content: ClaudeMessageContent;
}

/**
 * Request to Claude chat API.
 */
export interface ClaudeChatRequest {
  /** Model identifier (e.g., "claude-3-opus-20240229") */
  model: string;
  /** Maximum number of tokens to generate */
  maxTokens: number;
  /** Conversation history */
  messages: ClaudeMessage[];
  /** Optional system prompt - can be string or array of blocks with cache control */
  system?: string | ClaudeSystemBlock[];
  /** Optional temperature for response randomness (0.0-1.0) */
  temperature?: number;
  /** Optional array of tools the model can use */
  tools?: ClaudeTool[];
}

/**
 * Content block in Claude's response.
 */
export type ClaudeResponseContent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, any>;
    };

/**
 * Token usage information from Claude API.
 */
export interface ClaudeUsage {
  /** Number of tokens in the input */
  inputTokens: number;
  /** Number of tokens in the output */
  outputTokens: number;
  /** Number of tokens used to create cache (optional, only present when using prompt caching) */
  cacheCreationInputTokens?: number;
  /** Number of tokens read from cache (optional, only present when using prompt caching) */
  cacheReadInputTokens?: number;
}

/**
 * Response from Claude chat API.
 */
export interface ClaudeChatResponse {
  /** Unique identifier for this response */
  id: string;
  /** Array of content blocks in the response */
  content: ClaudeResponseContent[];
  /** Model that generated the response */
  model: string;
  /** Reason the response stopped (e.g., "end_turn", "max_tokens") */
  stopReason?: string;
  /** Token usage statistics */
  usage: ClaudeUsage;
}

/**
 * Tool definition for Claude API.
 */
export interface ClaudeTool {
  /** Name of the tool */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON schema describing the tool's input parameters */
  inputSchema: Record<string, any>;
  /** Optional cache control for prompt caching */
  cache_control?: {
    type: 'ephemeral';
  };
}

/**
 * System prompt content block with optional cache control
 */
export interface ClaudeSystemBlock {
  type: 'text';
  text: string;
  cache_control?: {
    type: 'ephemeral';
  };
}

// ============================================================================
// BaleyBots Types
// ============================================================================

export interface BaleybotRequest {
  stream_id: string;
  message: string;
  model: string;
  system_prompt?: string;
  tools?: Record<string, any>;
  agent_mode: boolean;
  max_tool_iterations?: number;
}

export interface BaleybotStreamEvent {
  streamId: string;
  event?: {
    type: string;
    content?: string;
    id?: string;
    toolName?: string;
    arguments?: Record<string, any>;
    argumentsDelta?: string;
    result?: any;
    error?: string;
  };
  type?: string;
  error?: {
    message: string;
  };
}
