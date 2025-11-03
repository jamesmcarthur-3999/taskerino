import type { AIProcessResult, Attachment } from '../types';

/**
 * Extended capture result with conversational context and AI guidance
 * Built on top of existing AIProcessResult from types.ts
 */
export interface CaptureResult extends AIProcessResult {
  // AI guidance (new in Phase 1)
  aiSummary: string; // Friendly AI summary: "Hey James, I found 2 tasks and created 1 note..."

  // Metadata (new in Phase 1)
  modelUsed: 'claude-haiku-4.5' | 'claude-sonnet-4.5' | 'gpt-4o-mini';
  processingTimeMs: number;

  // Conversational context for refinements (new in Phase 1)
  conversationContext: ConversationContext;

  // Optional fields based on output needs (notes/tasks may not always be present)
  notes: AIProcessResult['notes'];
  tasks: AIProcessResult['tasks'];

  // Created note IDs (for tracking draft notes in NotesContext)
  createdNoteIds?: string[];
}

/**
 * Conversation context for tracking refinement history
 * Used to maintain context across multiple refinement requests
 */
export interface ConversationContext {
  modelUsed: 'claude-haiku-4.5' | 'claude-sonnet-4.5' | 'gpt-4o-mini';
  messages: ConversationMessage[];
  originalCapture: string;
  originalAttachments: Attachment[];
  iterationCount: number; // Max 10
}

/**
 * Single message in the conversation history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

/**
 * Request to refine/modify existing capture results
 * User can iteratively request changes to the AI's output
 */
export interface RefinementRequest {
  userMessage: string; // e.g., "Split NVIDIA note into product and sales"
  currentResult: CaptureResult;
}

/**
 * Response from refinement operation
 */
export interface RefinementResponse {
  success: boolean;
  updatedResult?: CaptureResult; // Updated with new aiSummary
  error?: string;
}

/**
 * Error thrown when refinement max iterations exceeded
 */
export class RefinementError extends Error {
  public readonly reason: 'max_iterations' | 'model_error' | 'invalid_request';

  constructor(
    message: string,
    reason: 'max_iterations' | 'model_error' | 'invalid_request'
  ) {
    super(message);
    this.name = 'RefinementError';
    this.reason = reason;
  }
}

/**
 * Error thrown when all processing models fail
 */
export class ProcessingError extends Error {
  public readonly attemptedModels: string[];
  public readonly lastError: Error;

  constructor(
    message: string,
    attemptedModels: string[],
    lastError: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
    this.attemptedModels = attemptedModels;
    this.lastError = lastError;
  }
}

/**
 * Persisted review job for resuming capture reviews across sessions
 * Saved to storage when processing completes, deleted when review is saved/cancelled
 */
export interface PersistedReviewJob {
  id: string; // Unique job ID
  createdAt: string; // ISO timestamp when capture was created
  result: CaptureResult; // Full AI processing result with conversation context
  draftNoteIds: string[]; // IDs of draft notes created for this capture
  status: 'pending_review' | 'in_review' | 'completed' | 'cancelled';
  lastModified: string; // ISO timestamp for cleanup/sorting
}
