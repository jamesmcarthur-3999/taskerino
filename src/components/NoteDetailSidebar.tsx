import { useState, useRef, useEffect, useMemo } from 'react';
import type { Note } from '../types';
import { useNotes } from '../context/NotesContext';
import { useUI } from '../context/UIContext';
import { FileText, Trash2, ChevronDown, ChevronUp, Clock, Sparkles, X, Settings, Calendar } from 'lucide-react';
import { formatRelativeTime, formatNoteContent } from '../utils/helpers';
import { RichTextEditor } from './RichTextEditor';
import { InlineTagManager } from './InlineTagManager';
import { ConfirmDialog } from './ConfirmDialog';
import {
  MODAL_OVERLAY,
  getGlassClasses,
  getRadiusClass,
  getInfoGradient,
  getDangerGradient,
  getSuccessGradient,
} from '../design-system/theme';
import { RelationshipPills } from './relationships/RelationshipPills';
import { RelationshipModal } from './relationships/RelationshipModal';
import { EntityType } from '../types/relationships';

interface NoteDetailSidebarProps {
  noteId: string | undefined;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NoteDetailSidebar({ noteId }: NoteDetailSidebarProps) {
  const { state: notesState, dispatch: notesDispatch } = useNotes();
  const { state: uiState, dispatch: uiDispatch } = useUI();

  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');

  const [showTimeline, setShowTimeline] = useState(true);
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  // Find the note from state
  const note = notesState.notes.find(n => n.id === noteId);

  // Get all unique tags from all notes for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notesState.notes.forEach(n => {
      n.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [notesState.notes]);

  // Initialize edited values when note changes
  useEffect(() => {
    if (note) {
      setEditedContent(note.content);
      setEditedSummary(note.summary);
      isInitialMount.current = true; // Reset on note change
    }
  }, [note?.id]); // Only re-initialize when note ID changes

  const toggleUpdateExpanded = (updateId: string) => {
    setExpandedUpdates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(updateId)) {
        newSet.delete(updateId);
      } else {
        newSet.add(updateId);
      }
      return newSet;
    });
  };

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
      editedSummary !== note.summary
    );

    if (!hasChanges) {
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('saving');

    const timer = setTimeout(() => {
      const updatedNote: Note = {
        ...note,
        content: editedContent,
        summary: editedSummary,
      };
      notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
      setSaveStatus('saved');

      // Reset to idle after showing "saved" for 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    return () => clearTimeout(timer);
  }, [editedContent, editedSummary, noteId, notesDispatch]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingSummary && summaryInputRef.current) {
      summaryInputRef.current.focus();
      summaryInputRef.current.select();
    }
  }, [isEditingSummary]);

  const handleDelete = () => {
    if (!note) return;
    notesDispatch({ type: 'DELETE_NOTE', payload: note.id });
    uiDispatch({ type: 'CLOSE_SIDEBAR' });
  };

  const handleTagsChange = (newTags: string[]) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      tags: newTags,
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && uiState.sidebar.isOpen) {
        uiDispatch({ type: 'CLOSE_SIDEBAR' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiState.sidebar.isOpen, uiDispatch]);

  // Show loading or empty state if no note
  if (!note) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
            uiState.sidebar.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => uiDispatch({ type: 'CLOSE_SIDEBAR' })}
        />

        {/* Modal */}
        <div
          className={`fixed top-0 right-0 h-screen w-[35%] z-50 transition-transform duration-300 ease-out ${
            uiState.sidebar.isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className={`h-full ${getGlassClasses('extra-strong')} border-l border-white/40 shadow-2xl flex items-center justify-center`}>
            <p className="text-gray-500">Note not found</p>
          </div>
        </div>
      </>
    );
  }

  // Render save status indicator
  const renderSaveStatus = () => {
    if (saveStatus === 'saving') {
      return <span className={`text-xs font-medium ${getInfoGradient('light').textSecondary}`}>Saving...</span>;
    }
    if (saveStatus === 'saved') {
      return <span className={`text-xs font-medium ${getSuccessGradient('light').textSecondary}`}>✓ Saved</span>;
    }
    return null;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${MODAL_OVERLAY} z-40 transition-opacity duration-300 ${
          uiState.sidebar.isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => uiDispatch({ type: 'CLOSE_SIDEBAR' })}
      />

      {/* Modal - Beautiful Glass Sheet */}
      <div
        className={`fixed top-0 right-0 h-screen w-[35%] z-50 transition-transform duration-300 ease-out ${
          uiState.sidebar.isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className={`h-full ${getGlassClasses('extra-strong')} border-l border-white/40 shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header Section - Glass Morphism */}
        <div className={`flex-shrink-0 ${getGlassClasses('medium')} border-b-2 border-white/30 px-6 py-5`}>
          {/* Close Button - Top Right */}
          <button
            onClick={() => uiDispatch({ type: 'CLOSE_SIDEBAR' })}
            className="absolute top-6 right-6 p-2 hover:bg-white/80 rounded-xl transition-all hover:scale-105 active:scale-95 z-10"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          {/* Metadata Row: Source, Sentiment, Save Status */}
          <div className="flex items-center justify-between gap-2 mb-2 pr-12">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Source badge */}
              <span className={`text-xs px-2.5 py-1 rounded-full ${getGlassClasses('strong')} text-gray-600 capitalize font-medium`}>
                {note.source}
              </span>

              {/* Sentiment */}
              {note.metadata?.sentiment && (
                <span className={`text-xs px-2.5 py-1 rounded-full ${getGlassClasses('strong')} font-medium`}>
                  {note.metadata.sentiment === 'positive' ? '😊 Positive' :
                   note.metadata.sentiment === 'negative' ? '😞 Negative' : '😐 Neutral'}
                </span>
              )}
            </div>

            {/* Save status - Top Right */}
            {renderSaveStatus()}
          </div>

          {/* Title - Large and editable with modern styling */}
          <div className="mb-3">
            {isEditingSummary ? (
              <input
                ref={summaryInputRef}
                type="text"
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                onBlur={() => setIsEditingSummary(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingSummary(false);
                  if (e.key === 'Escape') {
                    setEditedSummary(note.summary);
                    setIsEditingSummary(false);
                  }
                }}
                className={`text-3xl font-bold text-gray-900 w-full border-b-2 ${getInfoGradient('light').textPrimary} focus:outline-none pb-2 bg-transparent`}
              />
            ) : (
              <h2
                onClick={() => setIsEditingSummary(true)}
                className={`text-3xl font-bold text-gray-900 cursor-text transition-all duration-300 pb-2 ${getInfoGradient('light').textPrimary}`}
                title="Click to edit title"
              >
                {editedSummary}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
              <Calendar className="w-3 h-3" />
              <span>{formatRelativeTime(note.timestamp)}</span>
              {note.lastUpdated && note.lastUpdated !== note.timestamp && (
                <>
                  <span>•</span>
                  <span>Updated {formatRelativeTime(note.lastUpdated)}</span>
                </>
              )}
            </div>
          </div>

          {/* Tags - Inline Manager */}
          <div className="mb-2">
            <InlineTagManager
              tags={note.tags || []}
              onTagsChange={handleTagsChange}
              allTags={allTags}
              editable={true}
              className="min-h-[32px]"
            />
          </div>

          {/* Relationships Section */}
          <div className="mb-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Relationships</h3>
              <button
                onClick={() => setRelationshipModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
              >
                <Settings className="w-4 h-4" />
                Manage
              </button>
            </div>

            <RelationshipPills
              entityId={note.id}
              entityType={EntityType.NOTE}
              maxVisible={5}
              showRemoveButton={true}
              onPillClick={() => setRelationshipModalOpen(true)}
            />
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Content Editor - Always Editable */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Content</h3>
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} hover:border-cyan-300 transition-all`}>
              <RichTextEditor
                content={editedContent}
                onChange={setEditedContent}
                placeholder="Write your note here... Use the toolbar for rich formatting!"
                autoFocus={false}
                minimal={false}
              />
            </div>
          </div>


          {/* Key Takeaways - Modern Glass Card */}
          {note.metadata?.keyPoints && note.metadata.keyPoints.length > 0 && (
            <div className={`${getInfoGradient('light').container} ${getRadiusClass('card')} p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className={`w-5 h-5 ${getInfoGradient('light').iconColor}`} />
                <h3 className={`text-sm font-bold uppercase tracking-wide ${getInfoGradient('light').textPrimary}`}>Key Takeaways</h3>
              </div>
              <ul className="space-y-3">
                {note.metadata.keyPoints.map((point, idx) => (
                  <li key={idx} className="text-sm text-gray-800 flex items-start gap-2">
                    <span className={`font-bold mt-0.5 ${getInfoGradient('light').textSecondary}`}>•</span>
                    <span className="flex-1">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}


          {/* Timeline - Modern Glass Container */}
          {note.updates && note.updates.length > 0 && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
              <button
                onClick={() => setShowTimeline(!showTimeline)}
                className={`w-full ${getInfoGradient('light').container} px-5 py-4 transition-colors text-left border-b-2 border-white/30`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className={`w-5 h-5 ${getInfoGradient('light').iconColor}`} />
                    <h3 className={`text-sm font-bold uppercase tracking-wide ${getInfoGradient('light').textPrimary}`}>
                      Timeline ({note.updates.length + 1} updates)
                    </h3>
                  </div>
                  {showTimeline ? (
                    <ChevronUp className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  )}
                </div>
              </button>

              {showTimeline && (
                <div className="p-6">
                  <div className="space-y-4">
                    {/* Current content as latest entry */}
                    <div className={`relative pl-6 pb-4 border-l-2 ${getInfoGradient('light').textSecondary}`}>
                      <div className={`absolute left-[-5px] top-0 w-2 h-2 ${getInfoGradient('light').iconBg} rounded-full shadow-md`} />
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${getInfoGradient('light').textSecondary}`}>Latest</span>
                        <span className="text-xs text-gray-500">{formatRelativeTime(note.lastUpdated || note.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{note.summary}</p>
                    </div>

                    {/* Historical updates */}
                    {note.updates?.slice().reverse().map((update, idx) => {
                      const isExpanded = expandedUpdates.has(update.id);
                      const isLast = idx === (note.updates?.length || 1) - 1;

                      return (
                        <div
                          key={update.id}
                          className={`relative pl-6 ${!isLast ? 'pb-4 border-l-2 border-gray-300' : ''}`}
                        >
                          <div className="absolute left-[-4px] top-0 w-1.5 h-1.5 bg-gray-400 rounded-full" />
                          <div className="flex items-center gap-2 mb-2">
                            {isLast && <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Original</span>}
                            <span className="text-xs text-gray-500">{formatRelativeTime(update.timestamp)}</span>
                          </div>
                          {update.summary && (
                            <p className="text-sm text-gray-700 mb-2">{update.summary}</p>
                          )}
                          <button
                            onClick={() => toggleUpdateExpanded(update.id)}
                            className={`text-xs font-semibold transition-colors ${getInfoGradient('light').textSecondary}`}
                          >
                            {isExpanded ? 'Hide' : 'View'} content
                          </button>
                          {isExpanded && (
                            <div className={`mt-3 ${getGlassClasses('subtle')} ${getRadiusClass('element')} p-4`}>
                              <div
                                className="prose prose-sm max-w-none text-gray-700"
                                dangerouslySetInnerHTML={{ __html: formatNoteContent(update.content) }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Related Topics */}
          {note.metadata?.relatedTopics && note.metadata.relatedTopics.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 font-medium">Related:</span>
              {note.metadata.relatedTopics.map((relatedTopic, idx) => (
                <span
                  key={idx}
                  className={`px-2.5 py-1 ${getGlassClasses('strong')} text-gray-700 rounded-full text-xs font-medium`}
                >
                  {relatedTopic}
                </span>
              ))}
            </div>
          )}

          {/* Original Input */}
          {note.sourceText && (
            <details className="group">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2 text-sm transition-all hover:scale-[1.01]">
                <FileText className="w-4 h-4" />
                View original input
              </summary>
              <div className={`mt-3 ${getGlassClasses('medium')} ${getRadiusClass('element')} p-4`}>
                <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                  {note.sourceText}
                </p>
              </div>
            </details>
          )}

          {/* Bottom padding for comfortable scrolling */}
          <div className="h-4" />
        </div>

        {/* Footer Actions - Glass Effect */}
        <div className={`flex-shrink-0 ${getGlassClasses('medium')} border-t-2 border-white/30 p-4 flex gap-2`}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className={`px-4 py-2 ${getDangerGradient('light').container} rounded-full border-2 hover:scale-105 active:scale-95 transition-all ${getDangerGradient('light').textSecondary} font-semibold text-sm flex items-center gap-2`}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          <button
            onClick={() => uiDispatch({ type: 'CLOSE_SIDEBAR' })}
            className={`flex-1 px-4 py-2 ${getInfoGradient('medium').container} text-white rounded-full hover:scale-105 active:scale-95 transition-all font-semibold text-sm`}
          >
            Close
          </button>
        </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Note?"
        message="This will permanently delete this note. This action cannot be undone."
        confirmLabel="Delete Note"
        variant="danger"
      />

      {/* Relationship Modal */}
      <RelationshipModal
        open={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        entityId={note.id}
        entityType={EntityType.NOTE}
      />
    </>
  );
}
