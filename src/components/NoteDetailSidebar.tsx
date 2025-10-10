import { useState, useRef, useEffect } from 'react';
import type { Note, Task } from '../types';
import { useApp } from '../context/AppContext';
import { Calendar, Tag as TagIcon, FileText, Trash2, ChevronDown, ChevronUp, Clock, Phone, Mail, MessageSquare, User, CheckSquare, Link2, Plus, X, MoreHorizontal, Sparkles } from 'lucide-react';
import { formatRelativeTime, generateNoteTitle, formatNoteContent, generateId } from '../utils/helpers';
import { getTasksByNoteId } from '../utils/navigation';
import { RichTextEditor } from './RichTextEditor';
import { AppSidebar } from './AppSidebar';

interface NoteDetailSidebarProps {
  noteId: string | undefined;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NoteDetailSidebar({ noteId }: NoteDetailSidebarProps) {
  const { state, dispatch } = useApp();
  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [showSourceText, setShowSourceText] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showLinkedTasks, setShowLinkedTasks] = useState(true);
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  // Find the note from state
  const note = state.notes.find(n => n.id === noteId);
  const topic = note ? state.topics.find(t => t.id === note.topicId) : undefined;

  // Get linked tasks
  const linkedTasks = noteId ? getTasksByNoteId(noteId, state.tasks) : [];

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
      dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
      setSaveStatus('saved');

      // Reset to idle after showing "saved" for 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    return () => clearTimeout(timer);
  }, [editedContent, editedSummary, noteId, dispatch]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingSummary && summaryInputRef.current) {
      summaryInputRef.current.focus();
      summaryInputRef.current.select();
    }
  }, [isEditingSummary]);

  useEffect(() => {
    if (isEditingContent && contentTextareaRef.current) {
      contentTextareaRef.current.focus();
    }
  }, [isEditingContent]);

  useEffect(() => {
    if (isEditingTags && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isEditingTags]);

  const handleDelete = () => {
    if (!note) return;
    if (confirm('Delete this note? This cannot be undone.')) {
      dispatch({ type: 'DELETE_NOTE', payload: note.id });
      dispatch({ type: 'CLOSE_SIDEBAR' });
    }
  };

  const handleTopicChange = (newTopicId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      topicId: newTopicId,
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleAddTag = () => {
    if (!note || !newTag.trim()) return;
    const trimmedTag = newTag.trim().toLowerCase();
    if (note.tags?.includes(trimmedTag)) {
      setNewTag('');
      return;
    }
    const updatedNote: Note = {
      ...note,
      tags: [...(note.tags || []), trimmedTag],
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      tags: note.tags?.filter(t => t !== tagToRemove) || [],
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const getPriorityFlag = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '';
    }
  };

  const getStatusBadge = (status: Task['status']) => {
    const badges = {
      todo: { label: 'To Do', className: 'bg-gray-100 text-gray-700' },
      'in-progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
      done: { label: 'Done', className: 'bg-green-100 text-green-700' },
      blocked: { label: 'Blocked', className: 'bg-red-100 text-red-700' },
    };
    const badge = badges[status];
    return (
      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  // Show loading or empty state if no note
  if (!note) {
    return (
      <AppSidebar
        title="Note Details"
        isOpen={state.sidebar.isOpen}
        onClose={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>Note not found</p>
        </div>
      </AppSidebar>
    );
  }

  // Render save status indicator
  const renderSaveStatus = () => {
    if (saveStatus === 'saving') {
      return <span className="text-xs text-cyan-600 font-medium">Saving...</span>;
    }
    if (saveStatus === 'saved') {
      return <span className="text-xs text-green-600 font-medium">✓ Saved</span>;
    }
    return null;
  };

  return (
    <AppSidebar
      title={generateNoteTitle(editedSummary)}
      isOpen={state.sidebar.isOpen}
      autoSaveStatus={saveStatus}
      onClose={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
    >
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Top: Topic selector + metadata */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            {/* Topic Dropdown */}
            <select
              value={note.topicId}
              onChange={(e) => handleTopicChange(e.target.value)}
              className="text-sm font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {state.topics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Source badge */}
            <span className="text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-500 capitalize">
              {note.source}
            </span>

            {/* Sentiment */}
            {note.metadata?.sentiment && (
              <span className="text-sm">
                {note.metadata.sentiment === 'positive' ? '😊' :
                 note.metadata.sentiment === 'negative' ? '😞' : '😐'}
              </span>
            )}
          </div>

          {/* Save status */}
          {renderSaveStatus()}
        </div>

        {/* Title - Large and editable */}
        <div>
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
              className="text-3xl font-bold text-gray-900 w-full border-b-2 border-cyan-500 focus:outline-none pb-2"
            />
          ) : (
            <h2
              onClick={() => setIsEditingSummary(true)}
              className="text-3xl font-bold text-gray-900 cursor-text hover:text-gray-700 transition-colors pb-2 border-b-2 border-transparent hover:border-gray-200"
              title="Click to edit title"
            >
              {editedSummary}
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
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

        {/* Quick Actions Bar */}
        <div className="flex gap-2 pb-4 border-b border-gray-200">
          <button
            onClick={() => setIsEditingTags(!isEditingTags)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              isEditingTags
                ? 'bg-violet-100 text-violet-700 border-2 border-violet-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Manage tags"
          >
            <TagIcon className="w-4 h-4" />
            Tags
          </button>
          <button
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
            title="Link to another note (coming soon)"
            disabled
          >
            <Link2 className="w-4 h-4" />
            Link
          </button>
          <button
            className="flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-all"
            onClick={() => setShowLinkedTasks(!showLinkedTasks)}
            title="View/create tasks"
          >
            <CheckSquare className="w-4 h-4" />
            Tasks {linkedTasks.length > 0 && `(${linkedTasks.length})`}
          </button>
        </div>

        {/* Main Content - PROMINENT */}
        <div>
          {isEditingContent ? (
            <div onBlur={() => setIsEditingContent(false)}>
              <RichTextEditor
                content={editedContent}
                onChange={setEditedContent}
                placeholder="Write your note here... Use the toolbar for rich formatting!"
                autoFocus
                minimal={false}
              />
            </div>
          ) : (
            <div
              onClick={() => setIsEditingContent(true)}
              className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-cyan-300 cursor-text transition-all min-h-[200px]"
              title="Click to edit content"
            >
              <div
                className="prose prose-base max-w-none"
                dangerouslySetInnerHTML={{ __html: formatNoteContent(editedContent) }}
              />
            </div>
          )}
        </div>

        {/* Inline Editable Tags */}
        {isEditingTags && (
          <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-violet-900 flex items-center gap-2">
                <TagIcon className="w-4 h-4" />
                Manage Tags
              </h3>
              <button
                onClick={() => setIsEditingTags(false)}
                className="text-violet-600 hover:text-violet-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {note.tags && note.tags.length > 0 ? (
                note.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-violet-200 text-violet-800 rounded-lg text-sm font-medium"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-violet-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-sm text-violet-600 italic">No tags yet</p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                ref={newTagInputRef}
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 border border-violet-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Tags display when not editing */}
        {!isEditingTags && note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400">Tags:</span>
            {note.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Key Takeaways - Compact */}
        {note.metadata?.keyPoints && note.metadata.keyPoints.length > 0 && (
          <div className="bg-cyan-50/50 rounded-lg p-3 border border-cyan-200">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <h3 className="text-xs font-bold text-cyan-900 uppercase tracking-wide">Key Takeaways</h3>
            </div>
            <ul className="space-y-1">
              {note.metadata.keyPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-cyan-600 font-bold">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Linked Tasks - Collapsible */}
        {showLinkedTasks && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowLinkedTasks(!showLinkedTasks)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Linked Tasks {linkedTasks.length > 0 && `(${linkedTasks.length})`}
                </h3>
              </div>
              <ChevronUp className="w-4 h-4 text-gray-600" />
            </button>

            <div className="p-4 bg-white space-y-2">
              {linkedTasks.length > 0 ? (
                linkedTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: task.id, label: task.title } })}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-cyan-300 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">{getPriorityFlag(task.priority)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(task.status)}
                        </div>
                        <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic text-center py-2">No tasks linked to this note</p>
              )}
            </div>
          </div>
        )}

        {/* Timeline - Show if there are updates */}
        {note.updates && note.updates.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Timeline ({note.updates.length + 1} updates)
                </h3>
              </div>
              {showTimeline ? (
                <ChevronUp className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              )}
            </button>

            {showTimeline && (
              <div className="p-4 bg-white">
                <div className="space-y-3">
                  {/* Current content as latest entry */}
                  <div className="relative pl-6 pb-3 border-l-2 border-blue-300">
                    <div className="absolute left-[-5px] top-0 w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600">Latest</span>
                      <span className="text-xs text-gray-500">{formatRelativeTime(note.lastUpdated || note.timestamp)}</span>
                    </div>
                    <p className="text-xs text-gray-600">{note.summary}</p>
                  </div>

                  {/* Historical updates */}
                  {note.updates?.slice().reverse().map((update, idx) => {
                    const isExpanded = expandedUpdates.has(update.id);
                    const isLast = idx === (note.updates?.length || 1) - 1;

                    return (
                      <div
                        key={update.id}
                        className={`relative pl-6 ${!isLast ? 'pb-3 border-l-2 border-gray-300' : ''}`}
                      >
                        <div className="absolute left-[-4px] top-0 w-1.5 h-1.5 bg-gray-400 rounded-full" />
                        <div className="flex items-center gap-2 mb-1">
                          {isLast && <span className="text-xs font-semibold text-gray-500">Original</span>}
                          <span className="text-xs text-gray-500">{formatRelativeTime(update.timestamp)}</span>
                        </div>
                        {update.summary && (
                          <p className="text-xs text-gray-600 mb-1">{update.summary}</p>
                        )}
                        <button
                          onClick={() => toggleUpdateExpanded(update.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {isExpanded ? 'Hide' : 'View'} content
                        </button>
                        {isExpanded && (
                          <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs">
                            <div
                              className="prose prose-xs max-w-none text-gray-700"
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
          <div className="flex flex-wrap gap-1.5 items-center text-xs">
            <span className="text-gray-400">Related:</span>
            {note.metadata.relatedTopics.map((relatedTopic, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
              >
                {relatedTopic}
              </span>
            ))}
          </div>
        )}

        {/* Original Input - Small, at bottom */}
        {note.sourceText && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1">
              <FileText className="w-3 h-3" />
              View original input
            </summary>
            <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {note.sourceText}
              </p>
            </div>
          </details>
        )}

        {/* Timestamps */}
        <div className="pt-3 border-t border-gray-200 text-xs text-gray-400">
          Created: {new Date(note.timestamp).toLocaleString()}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors text-sm flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>

        <button
          onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:shadow-lg transition-all text-sm"
        >
          Close
        </button>
      </div>
    </AppSidebar>
  );
}
