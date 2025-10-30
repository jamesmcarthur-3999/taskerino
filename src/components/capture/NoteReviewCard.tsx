import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Trash2, RotateCcw, Smile, Meh, Frown } from 'lucide-react';
import { useNotes } from '../../context/NotesContext';
import { RichTextEditor } from '../RichTextEditor';
import { InlineTagManager } from '../InlineTagManager';
import {
  getGlassClasses,
  getRadiusClass,
  TYPOGRAPHY,
  TEXT_COLORS,
  TRANSITIONS,
  SHADOWS,
} from '../../design-system/theme';
import type { Note } from '../../types';

interface NoteReviewCardProps {
  noteId: string;
  onDelete: () => void;
  isDeleted: boolean;
}

/**
 * Expandable note card for AI capture review
 * - Collapsed: Summary + HTML preview (3 lines) + badges
 * - Expanded: Full TipTap editor + editable metadata
 * - Auto-saves to NotesContext with 500ms debounce
 */
export function NoteReviewCard({ noteId, onDelete, isDeleted }: NoteReviewCardProps) {
  const { state: notesState, updateNote } = useNotes();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [editedSentiment, setEditedSentiment] = useState<'positive' | 'neutral' | 'negative' | undefined>();
  const isInitialMount = useRef(true);

  // Find the note from state
  const note = notesState.notes.find(n => n.id === noteId);

  // Initialize edited values when note changes
  useEffect(() => {
    if (note) {
      setEditedContent(note.content);
      setEditedSummary(note.summary);
      setEditedTags(note.tags || []);
      setEditedSentiment(note.metadata?.sentiment);
      isInitialMount.current = true; // Reset on note change
    }
  }, [note?.id]);

  // Auto-save with debounce (500ms)
  useEffect(() => {
    if (!note || !noteId) return;

    // Skip auto-save on initial load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Check for actual changes
    const hasChanges = (
      editedContent !== note.content ||
      editedSummary !== note.summary ||
      JSON.stringify(editedTags) !== JSON.stringify(note.tags) ||
      editedSentiment !== note.metadata?.sentiment
    );

    if (!hasChanges) {
      return;
    }

    const timer = setTimeout(() => {
      const updatedNote: Note = {
        ...note,
        content: editedContent,
        summary: editedSummary,
        tags: editedTags,
        metadata: {
          ...note.metadata,
          sentiment: editedSentiment,
        },
        lastUpdated: new Date().toISOString(),
      };
      updateNote(updatedNote);
    }, 500);

    return () => clearTimeout(timer);
  }, [editedContent, editedSummary, editedTags, editedSentiment, noteId, updateNote]);

  if (!note) {
    return null;
  }

  const getSentimentIcon = (sentiment?: 'positive' | 'neutral' | 'negative') => {
    switch (sentiment) {
      case 'positive': return { icon: <Smile className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50' };
      case 'neutral': return { icon: <Meh className="w-4 h-4" />, color: 'text-gray-600', bg: 'bg-gray-50' };
      case 'negative': return { icon: <Frown className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-50' };
      default: return null;
    }
  };

  const sentimentInfo = getSentimentIcon(editedSentiment);

  return (
    <div
      className={`${getGlassClasses('subtle')} ${getRadiusClass('card')} overflow-hidden border-2 ${
        isDeleted ? 'border-red-300 opacity-50' : 'border-white/60'
      } ${TRANSITIONS.standard} ${isDeleted ? 'pointer-events-none' : ''}`}
    >
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-4 flex items-center justify-between hover:bg-white/30 ${TRANSITIONS.standard} text-left`}
      >
        <div className="flex-1 min-w-0">
          <h3 className={`${TYPOGRAPHY.heading.h3} ${TEXT_COLORS.primary} truncate`}>
            {editedSummary}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-cyan-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-cyan-600" />
          )}
        </div>
      </button>

      {/* Content */}
      <div className="border-t-2 border-white/30">
        {!isExpanded ? (
          // COLLAPSED STATE - Preview
          <div className="p-4 space-y-3">
            {/* HTML Preview - Read-only TipTap with line clamp */}
            <div className="line-clamp-3 text-sm text-gray-700">
              <RichTextEditor
                content={note.content}
                onChange={() => {}} // No-op for read-only
                editable={false}
              />
            </div>

            {/* Metadata Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tags */}
              {editedTags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className={`px-2 py-1 ${getRadiusClass('pill')} bg-cyan-50 text-cyan-700 text-xs font-medium border border-cyan-200`}
                >
                  #{tag}
                </span>
              ))}
              {editedTags.length > 3 && (
                <span className="text-xs text-gray-500">+{editedTags.length - 3} more</span>
              )}

              {/* Sentiment */}
              {sentimentInfo && (
                <span
                  className={`px-2 py-1 ${getRadiusClass('pill')} ${sentimentInfo.bg} ${sentimentInfo.color} text-xs font-medium border border-current/20 flex items-center gap-1`}
                >
                  {sentimentInfo.icon}
                  {editedSentiment}
                </span>
              )}
            </div>

            {/* Delete/Restore Button */}
            <div className="flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className={`px-3 py-1.5 ${getRadiusClass('element')} text-sm font-medium flex items-center gap-2 ${
                  isDeleted
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                } ${TRANSITIONS.standard} ${SHADOWS.button}`}
              >
                {isDeleted ? (
                  <>
                    <RotateCcw size={14} />
                    Restore
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          // EXPANDED STATE - Full Editor
          <div className="p-4 space-y-4">
            {/* Editable Summary */}
            <div>
              <label className={`block ${TYPOGRAPHY.label.default} ${TEXT_COLORS.secondary} mb-1`}>
                Summary
              </label>
              <input
                type="text"
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                className={`w-full px-3 py-2 ${getGlassClasses('medium')} border-2 border-white/60 ${getRadiusClass('field')} focus:border-cyan-400 focus:outline-none ${TYPOGRAPHY.body.default} ${TEXT_COLORS.primary} ${TRANSITIONS.standard}`}
                placeholder="Note summary..."
              />
            </div>

            {/* Full TipTap Editor */}
            <div>
              <label className={`block ${TYPOGRAPHY.label.default} ${TEXT_COLORS.secondary} mb-1`}>
                Content
              </label>
              <div className={`${getGlassClasses('subtle')} ${getRadiusClass('field')} overflow-hidden border-2 border-white/60`}>
                <RichTextEditor
                  content={editedContent}
                  onChange={setEditedContent}
                  editable={true}
                />
              </div>
            </div>

            {/* Tag Editor */}
            <div>
              <label className={`block ${TYPOGRAPHY.label.default} ${TEXT_COLORS.secondary} mb-1`}>
                Tags
              </label>
              <InlineTagManager
                tags={editedTags}
                onChange={setEditedTags}
                allTags={[]} // No autocomplete suggestions in review
              />
            </div>

            {/* Sentiment Selector */}
            <div>
              <label className={`block ${TYPOGRAPHY.label.default} ${TEXT_COLORS.secondary} mb-2`}>
                Sentiment
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditedSentiment('positive')}
                  className={`flex-1 px-3 py-2 ${getRadiusClass('element')} flex items-center justify-center gap-2 text-sm font-medium ${TRANSITIONS.standard} ${
                    editedSentiment === 'positive'
                      ? 'bg-green-500 text-white shadow-lg'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <Smile className="w-4 h-4" />
                  Positive
                </button>
                <button
                  onClick={() => setEditedSentiment('neutral')}
                  className={`flex-1 px-3 py-2 ${getRadiusClass('element')} flex items-center justify-center gap-2 text-sm font-medium ${TRANSITIONS.standard} ${
                    editedSentiment === 'neutral'
                      ? 'bg-gray-500 text-white shadow-lg'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Meh className="w-4 h-4" />
                  Neutral
                </button>
                <button
                  onClick={() => setEditedSentiment('negative')}
                  className={`flex-1 px-3 py-2 ${getRadiusClass('element')} flex items-center justify-center gap-2 text-sm font-medium ${TRANSITIONS.standard} ${
                    editedSentiment === 'negative'
                      ? 'bg-red-500 text-white shadow-lg'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <Frown className="w-4 h-4" />
                  Negative
                </button>
              </div>
            </div>

            {/* Delete/Restore Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className={`px-3 py-1.5 ${getRadiusClass('element')} text-sm font-medium flex items-center gap-2 ${
                  isDeleted
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                } ${TRANSITIONS.standard} ${SHADOWS.button}`}
              >
                {isDeleted ? (
                  <>
                    <RotateCcw size={14} />
                    Restore
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
