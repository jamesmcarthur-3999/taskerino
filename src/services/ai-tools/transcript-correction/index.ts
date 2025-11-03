/**
 * Transcript Correction Tools
 *
 * Tools for correcting and upgrading session transcripts.
 * These tools require permission in chat context (Ned).
 */

export { default as updateTranscript } from './updateTranscript';

// Re-export types for convenience
export type {
  UpdateTranscriptInput,
  UpdateTranscriptOutput
} from '../types';
