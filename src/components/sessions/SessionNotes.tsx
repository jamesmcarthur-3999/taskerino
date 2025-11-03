import React, { useState, useRef, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, X, Check, Clock, AlertTriangle } from 'lucide-react';
import type { Session, SessionContextItem } from '../../types';
import { getGlassClasses, getRadiusClass, TRANSITIONS } from '../../design-system/theme';

interface SessionNotesProps {
  session: Session;
  onAddContext: (contextItem: Omit<SessionContextItem, 'id' | 'sessionId'>) => void;
  onUpdateContext?: (contextId: string, content: string) => void;
  onDeleteContext?: (contextId: string) => void;
}

const MAX_NOTES = 100;
const WARNING_THRESHOLD = 80;

export function SessionNotes({ session, onAddContext, onUpdateContext, onDeleteContext }: SessionNotesProps) {
  const [noteInput, setNoteInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const contextItems = session.contextItems || [];
  const sortedItems = [...contextItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const isNearLimit = contextItems.length >= WARNING_THRESHOLD;
  const isAtLimit = contextItems.length >= MAX_NOTES;

  // Auto-focus edit input when editing
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleAddNote = () => {
    const trimmed = noteInput.trim();
    if (!trimmed || isAtLimit) return;

    onAddContext({
      timestamp: new Date().toISOString(),
      type: 'note',
      content: trimmed,
    });

    setNoteInput('');
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const startEditing = (item: SessionContextItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = () => {
    const trimmed = editContent.trim();
    if (trimmed && editingId && onUpdateContext) {
      onUpdateContext(editingId, trimmed);
      cancelEditing();
    }
  };

  const handleEditKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleDelete = (contextId: string) => {
    if (onDeleteContext && window.confirm('Delete this note?')) {
      onDeleteContext(contextId);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/20">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-gray-600" />
          <span className="text-sm font-semibold text-gray-900">
            Session Notes
          </span>
          <span className={`text-xs font-medium ${
            isAtLimit ? 'text-red-600' : isNearLimit ? 'text-orange-600' : 'text-gray-500'
          }`}>
            {contextItems.length} / {MAX_NOTES}
          </span>
        </div>

        {isNearLimit && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 rounded-full">
            <AlertTriangle size={12} className="text-orange-600" />
            <span className="text-[10px] font-semibold text-orange-700">
              {isAtLimit ? 'LIMIT REACHED' : 'NEAR LIMIT'}
            </span>
          </div>
        )}
      </div>

      {/* Add note input */}
      <div className="p-4 border-b border-white/20">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isAtLimit ? "Note limit reached" : "Add a quick note... (Enter to save, Shift+Enter for new line)"}
            disabled={isAtLimit}
            className={`w-full px-4 py-3 pr-12 ${getGlassClasses('subtle')} ${getRadiusClass('field')} text-sm resize-none ${TRANSITIONS.standard} ${
              isAtLimit ? 'opacity-50 cursor-not-allowed' : 'focus:shadow-lg'
            }`}
            rows={2}
          />
          <button
            onClick={handleAddNote}
            disabled={!noteInput.trim() || isAtLimit}
            className={`absolute right-2 bottom-2 p-2 bg-cyan-500 text-white ${getRadiusClass('element')} ${TRANSITIONS.standard} ${
              !noteInput.trim() || isAtLimit
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-cyan-600 hover:shadow-lg'
            }`}
          >
            <Plus size={16} />
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-1.5">
          Quick notes, observations, or reminders during your session
        </p>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <FileText size={40} className="text-gray-400 mb-3" />
            <p className="text-sm text-gray-600">No notes yet</p>
            <p className="text-xs text-gray-500 mt-1">Add notes as you work</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedItems.map((item) => (
              <div
                key={item.id}
                className={`group p-3 ${getGlassClasses('medium')} ${getRadiusClass('field')} ${TRANSITIONS.standard} hover:shadow-md`}
              >
                {editingId === item.id ? (
                  // Edit mode
                  <div className="space-y-2">
                    <textarea
                      ref={editInputRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={handleEditKeyPress}
                      className={`w-full px-3 py-2 ${getGlassClasses('subtle')} ${getRadiusClass('element')} text-sm resize-none ${TRANSITIONS.standard}`}
                      rows={3}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={cancelEditing}
                        className={`px-3 py-1 flex items-center gap-1 text-xs font-medium text-gray-700 hover:bg-white/50 ${getRadiusClass('element')} ${TRANSITIONS.standard}`}
                      >
                        <X size={12} />
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={!editContent.trim()}
                        className={`px-3 py-1 flex items-center gap-1 text-xs font-medium bg-cyan-500 text-white ${getRadiusClass('element')} ${TRANSITIONS.standard} ${
                          !editContent.trim()
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-cyan-600'
                        }`}
                      >
                        <Check size={12} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className="text-gray-500" />
                        <span className="text-[11px] font-medium text-gray-600">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onUpdateContext && (
                          <button
                            onClick={() => startEditing(item)}
                            className={`p-1 hover:bg-white/50 ${getRadiusClass('element')} ${TRANSITIONS.standard}`}
                            title="Edit note"
                          >
                            <Edit2 size={12} className="text-gray-600" />
                          </button>
                        )}
                        {onDeleteContext && (
                          <button
                            onClick={() => handleDelete(item.id)}
                            className={`p-1 hover:bg-red-500/10 ${getRadiusClass('element')} ${TRANSITIONS.standard}`}
                            title="Delete note"
                          >
                            <Trash2 size={12} className="text-red-600" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>

                    {item.linkedItemId && (
                      <div className="mt-2 px-2 py-1 bg-cyan-500/10 rounded text-[10px] text-cyan-700 inline-block">
                        Linked to {item.type}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      {sortedItems.length > 0 && (
        <div className="px-4 py-2 border-t border-white/20">
          <p className="text-[10px] text-gray-500 text-center">
            Notes are saved automatically and will be included in the session summary
          </p>
        </div>
      )}
    </div>
  );
}
