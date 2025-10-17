import React, { useState, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';
import { X, Copy, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { truncateText, formatRelativeTime } from '../utils/helpers';
import { getGlassClasses, getRadiusClass } from '../design-system/theme';

export function ReferencePanel() {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { state: notesState } = useNotes();
  const { state: entitiesState } = useEntities();
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [width, setWidth] = useState(uiState.preferences.referencePanelWidth);
  const [isResizing, setIsResizing] = useState(false);

  if (!uiState.referencePanelOpen || uiState.pinnedNotes.length === 0) {
    return null;
  }

  const handleUnpin = (noteId: string) => {
    uiDispatch({ type: 'UNPIN_NOTE', payload: noteId });
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  };

  const handleCopyContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Copied!',
          message: 'Note content copied to clipboard',
        }
      });
    } catch {
      uiDispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Copy Failed',
          message: 'Could not copy to clipboard',
        }
      });
    }
  };

  const handleOpenInSidebar = (noteId: string) => {
    const note = notesState.notes.find(n => n.id === noteId);
    if (note) {
      uiDispatch({
        type: 'OPEN_SIDEBAR',
        payload: { type: 'note', itemId: noteId, label: note.summary }
      });
    }
  };

  const toggleExpand = (noteId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
    const clampedWidth = Math.min(Math.max(newWidth, 20), 50); // 20-50%
    setWidth(clampedWidth);

    // Save to preferences
    uiDispatch({
      type: 'UPDATE_PREFERENCES',
      payload: { referencePanelWidth: clampedWidth }
    });
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Attach resize listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  return (
    <>
      <div
        className={`fixed top-16 bottom-0 right-0 ${getGlassClasses('medium')} border-l-2 border-white/50 shadow-2xl flex flex-col z-30 transition-transform`}
        style={{ width: `${width}%` }}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-cyan-500 transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-gray-300 group-hover:bg-cyan-500 rounded-r transition-colors" />
        </div>

        {/* Header */}
        <div className={`p-4 border-b border-white/50 ${getGlassClasses('subtle')}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">📌 References</h3>
              <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-bold rounded-full">
                {uiState.pinnedNotes.length}/5
              </span>
            </div>
            <button
              onClick={() => uiDispatch({ type: 'TOGGLE_REFERENCE_PANEL' })}
              className={`p-1 hover:bg-white ${getRadiusClass('element')} transition-colors`}
              title="Close reference panel (⌘⇧R)"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {uiState.pinnedNotes.map(noteId => {
            const note = notesState.notes.find(n => n.id === noteId);
            if (!note) return null;

            const topic = entitiesState.topics.find(t => t.id === note.topicId);
            const isExpanded = expandedNotes.has(noteId);

            return (
              <div
                key={noteId}
                className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} border-2 border-white/50 overflow-hidden hover:border-cyan-300 transition-all`}
              >
                {/* Note Header */}
                <div className="p-3 border-b border-gray-200 bg-white/50">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => toggleExpand(noteId)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 truncate">
                            {note.summary}
                          </h4>
                          {topic && (
                            <p className="text-xs text-cyan-600 mt-0.5">
                              {topic.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleUnpin(noteId)}
                      className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors flex-shrink-0"
                      title="Unpin note"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Note Content (expandable) */}
                {isExpanded && (
                  <div className="p-3 space-y-3">
                    <div className="text-sm text-gray-700 leading-relaxed max-h-64 overflow-y-auto">
                      {note.content}
                    </div>

                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {note.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{formatRelativeTime(note.timestamp)}</span>
                      <span>•</span>
                      <span>{note.source}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-white/50">
                      <button
                        onClick={() => handleCopyContent(note.content)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-sm font-medium transition-colors`}
                      >
                        <Copy className="w-4 h-4" />
                        Copy
                      </button>
                      <button
                        onClick={() => handleOpenInSidebar(noteId)}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${getGlassClasses('subtle')} text-cyan-700 ${getRadiusClass('element')} text-sm font-medium transition-colors`}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open
                      </button>
                    </div>
                  </div>
                )}

                {/* Collapsed Preview */}
                {!isExpanded && (
                  <div className="p-3 bg-gray-50/50">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {truncateText(note.content, 100)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {uiState.pinnedNotes.length >= 5 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-600 text-center">
              Maximum 5 notes pinned. Unpin a note to add another.
            </p>
          </div>
        )}
      </div>

      {/* Overlay when resizing */}
      {isResizing && (
        <div className="fixed inset-0 z-40 cursor-ew-resize" />
      )}
    </>
  );
}
