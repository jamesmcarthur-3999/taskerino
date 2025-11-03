/**
 * NoteSuggestionCard
 *
 * Display a single note suggestion from AI with "Create Note" button.
 * Converts AI suggestion into an actual note with one click.
 *
 * @example
 * ```tsx
 * <NoteSuggestionCard
 *   suggestion={{
 *     content: "## Meeting Notes\n\nDiscussed API integration strategy...",
 *     context: "Detected from conversation in audio",
 *     tags: ["meeting", "planning"],
 *     topicIds: ["topic-api-123"]
 *   }}
 *   sessionId="session-123"
 *   onNoteCreated={(noteId) => console.log('Note created:', noteId)}
 *   onDismiss={(suggestionId) => console.log('Dismissed:', suggestionId)}
 * />
 * ```
 */

import React, { useState } from 'react';
import { FileText, Plus, X, CheckCircle2, Loader2 } from 'lucide-react';
import { getGlassClasses, getRadiusClass } from '@/design-system/theme';
import { createNoteFromSuggestion } from '@/services/liveSession/updateApi';
import type { NoteSuggestion } from '@/services/liveSession/toolExecutor';

interface NoteSuggestionCardProps {
  suggestion: NoteSuggestion;
  sessionId: string;
  onNoteCreated?: (noteId: string) => void;
  onDismiss?: (suggestionId: string) => void;
}

export const NoteSuggestionCard: React.FC<NoteSuggestionCardProps> = ({
  suggestion,
  sessionId,
  onNoteCreated,
  onDismiss
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateNote = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const note = await createNoteFromSuggestion(suggestion, sessionId);
      setIsCreated(true);
      setCreatedNoteId(note.id);
      onNoteCreated?.(note.id);
    } catch (err) {
      console.error('[NoteSuggestionCard] Failed to create note:', err);
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDismiss = () => {
    // Generate a unique ID for the suggestion if not present
    const suggestionId = `note-suggestion-${Date.now()}`;
    onDismiss?.(suggestionId);
  };

  // Truncate content preview to first 150 characters
  const contentPreview =
    suggestion.content.length > 150
      ? suggestion.content.substring(0, 150) + '...'
      : suggestion.content;

  return (
    <div
      className={`${getGlassClasses('medium')} ${getRadiusClass(
        'card'
      )} p-4 border-2 transition-all relative group ${
        isCreated ? 'border-purple-400 bg-purple-50/30' : 'border-gray-200 hover:border-purple-300'
      }`}
      role="article"
      aria-label="Note suggestion"
    >
      {/* Dismiss Button */}
      {!isCreated && onDismiss && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 rounded"
          aria-label="Dismiss suggestion"
        >
          <X size={16} className="text-gray-400 hover:text-gray-600" />
        </button>
      )}

      {/* Note Icon */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <FileText className="text-purple-600" size={20} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-2">Suggested Note</h4>
          {suggestion.context && (
            <p className="text-sm text-gray-600 mb-2">{suggestion.context}</p>
          )}
          {/* Note Preview */}
          <div
            className={`${getGlassClasses(
              'subtle'
            )} rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap`}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
            title={suggestion.content}
          >
            {contentPreview}
          </div>
        </div>
      </div>

      {/* Tags (if present) */}
      {suggestion.tags && suggestion.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {suggestion.tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {!isCreated ? (
          <button
            onClick={handleCreateNote}
            disabled={isCreating}
            className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            aria-label="Create note from suggestion"
          >
            {isCreating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create Note
              </>
            )}
          </button>
        ) : (
          <>
            <div className="flex-1 flex items-center justify-center gap-2 text-purple-600 font-medium">
              <CheckCircle2 size={18} />
              Note Created
            </div>
            {createdNoteId && (
              <button
                onClick={() => {
                  // TODO: Open note sidebar with createdNoteId
                  console.log('View note:', createdNoteId);
                }}
                className={`py-2 px-4 ${getGlassClasses(
                  'medium'
                )} border border-gray-300 rounded-lg font-medium hover:border-purple-400 transition-colors`}
                aria-label="View created note"
              >
                View Note
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
