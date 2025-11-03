/**
 * Suggestion Tools
 *
 * Tools for creating and managing entity suggestions.
 * Suggestions are stored for user approval before entity creation.
 */

export { default as suggestEntity } from './suggestEntity';
export {
  loadPendingSuggestions,
  getSuggestion,
  updateSuggestionStatus,
  deleteSuggestion
} from './suggestEntity';

// Re-export types for convenience
export type {
  SuggestEntityInput,
  SuggestEntityOutput,
  EntitySuggestion
} from '../types';
