import { useState, useRef, useEffect } from 'react';
import type { Note, Task } from '../types';
import { useApp } from '../context/AppContext';
import { Calendar, Tag as TagIcon, FileText, Trash2, Clock, Phone, Mail, MessageSquare, User, CheckSquare, Link2, Plus, X, Sparkles } from 'lucide-react';
import { formatRelativeTime, generateNoteTitle, formatNoteContent } from '../utils/helpers';
import { getTasksByNoteId } from '../utils/navigation';
import { RichTextEditor } from './RichTextEditor';

interface NoteDetailInlineProps {
  noteId: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NoteDetailInline({ noteId }: NoteDetailInlineProps) {
  const { state, dispatch } = useApp();
  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isEditingRelationships, setIsEditingRelationships] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  // Find the note from state
  const note = state.notes.find(n => n.id === noteId);

  // Get all related entities (companies, contacts, topics)
  const relatedCompanies = note ? state.companies.filter(c => note.companyIds?.includes(c.id)) : [];
  const relatedContacts = note ? state.contacts.filter(c => note.contactIds?.includes(c.id)) : [];
  const relatedTopics = note ? state.topics.filter(t => note.topicIds?.includes(t.id)) : [];

  // Legacy support
  if (note?.topicId) {
    const legacyCompany = state.companies.find(c => c.id === note.topicId);
    const legacyContact = state.contacts.find(c => c.id === note.topicId);
    const legacyTopic = state.topics.find(t => t.id === note.topicId);
    if (legacyCompany && !relatedCompanies.some(c => c.id === legacyCompany.id)) relatedCompanies.push(legacyCompany);
    if (legacyContact && !relatedContacts.some(c => c.id === legacyContact.id)) relatedContacts.push(legacyContact);
    if (legacyTopic && !relatedTopics.some(t => t.id === legacyTopic.id)) relatedTopics.push(legacyTopic);
  }

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
    if (isEditingTags && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isEditingTags]);

  const handleDelete = () => {
    if (!note) return;
    if (confirm('Delete this note? This cannot be undone.')) {
      dispatch({ type: 'DELETE_NOTE', payload: note.id });
    }
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

  const handleAddCompany = (companyId: string) => {
    if (!note) return;
    const currentIds = note.companyIds || [];
    if (currentIds.includes(companyId)) return;
    const updatedNote: Note = {
      ...note,
      companyIds: [...currentIds, companyId],
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleRemoveCompany = (companyId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      companyIds: (note.companyIds || []).filter(id => id !== companyId),
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleAddContact = (contactId: string) => {
    if (!note) return;
    const currentIds = note.contactIds || [];
    if (currentIds.includes(contactId)) return;
    const updatedNote: Note = {
      ...note,
      contactIds: [...currentIds, contactId],
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleRemoveContact = (contactId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      contactIds: (note.contactIds || []).filter(id => id !== contactId),
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleAddTopic = (topicId: string) => {
    if (!note) return;
    const currentIds = note.topicIds || [];
    if (currentIds.includes(topicId)) return;
    const updatedNote: Note = {
      ...note,
      topicIds: [...currentIds, topicId],
    };
    dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleRemoveTopic = (topicId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      topicIds: (note.topicIds || []).filter(id => id !== topicId),
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
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 mb-2">Select a note</p>
          <p className="text-gray-600">Choose a note from the list to view and edit</p>
        </div>
      </div>
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
    <div className="h-full overflow-y-auto relative">
      {/* Main Content Area */}
      <div className="px-8 py-6 max-w-5xl mx-auto space-y-4">
        {/* Metadata Pills - Inline at Top */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Entity Relationships */}
          {relatedCompanies.map(company => (
            <span key={company.id} className="inline-flex items-center gap-1 font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 whitespace-nowrap">
              <span>🏢</span>
              <span>{company.name}</span>
            </span>
          ))}
          {relatedContacts.map(contact => (
            <span key={contact.id} className="inline-flex items-center gap-1 font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 whitespace-nowrap">
              <span>👤</span>
              <span>{contact.name}</span>
            </span>
          ))}
          {relatedTopics.map(topic => (
            <span key={topic.id} className="inline-flex items-center gap-1 font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 whitespace-nowrap">
              <span>📌</span>
              <span>{topic.name}</span>
            </span>
          ))}

          {/* Show placeholder if no entities */}
          {relatedCompanies.length === 0 && relatedContacts.length === 0 && relatedTopics.length === 0 && (
            <span className="font-medium text-gray-400 whitespace-nowrap">
              No relationships
            </span>
          )}

          {/* Divider */}
          <div className="w-px h-3 bg-gray-200 flex-shrink-0" />

          {/* Source badge */}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize font-medium whitespace-nowrap">
            {note.source}
          </span>

          {/* Sentiment */}
          {note.metadata?.sentiment && (
            <span className="flex-shrink-0">
              {note.metadata.sentiment === 'positive' ? '😊' :
               note.metadata.sentiment === 'negative' ? '😞' : '😐'}
            </span>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-1 text-[10px] text-gray-400 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span className="whitespace-nowrap">{formatRelativeTime(note.timestamp)}</span>
          </div>

          {/* Save status */}
          <div className="flex-shrink-0">
            {renderSaveStatus()}
          </div>
        </div>
        {/* Title - Large and prominent */}
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
              className="text-4xl font-bold text-gray-900 w-full border-b-2 border-cyan-500 focus:outline-none pb-3 bg-transparent"
            />
          ) : (
            <h1
              onClick={() => setIsEditingSummary(true)}
              className="text-4xl font-bold text-gray-900 cursor-text hover:text-gray-700 transition-colors pb-3 border-b-2 border-transparent hover:border-gray-200"
              title="Click to edit title"
            >
              {editedSummary}
            </h1>
          )}
        </div>

        {/* Meta Row - Relationships, Tags, Tasks */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Relationships Button */}
          <button
            onClick={() => setIsEditingRelationships(!isEditingRelationships)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isEditingRelationships
                ? 'bg-gray-100 text-gray-700 border-gray-300'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Edit Relationships
          </button>

          {/* Tags Display/Edit */}
          {!isEditingTags && note.tags && note.tags.length > 0 && (
            <div className="flex items-center gap-1.5">
              {note.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200"
                >
                  #{tag}
                </span>
              ))}
              {note.tags.length > 3 && (
                <span className="text-xs text-gray-400">+{note.tags.length - 3}</span>
              )}
            </div>
          )}

          <button
            onClick={() => setIsEditingTags(!isEditingTags)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isEditingTags
                ? 'bg-gray-100 text-gray-700 border-gray-300'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
            }`}
          >
            <TagIcon className="w-3.5 h-3.5" />
            Edit Tags
          </button>

          {linkedTasks.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200">
              <CheckSquare className="w-3.5 h-3.5" />
              {linkedTasks.length} {linkedTasks.length === 1 ? 'task' : 'tasks'}
            </div>
          )}
        </div>

        {/* Compact Relationship Editor */}
        {isEditingRelationships && (
          <div className="bg-gray-50/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Relationships
              </h3>
              <button
                onClick={() => setIsEditingRelationships(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Companies */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1">
                  <span>🏢</span>
                  Companies
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {relatedCompanies.map(company => (
                    <span
                      key={company.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200"
                    >
                      🏢 {company.name}
                      <button
                        onClick={() => handleRemoveCompany(company.id)}
                        className="hover:text-gray-900 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddCompany(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 bg-white"
                >
                  <option value="">+ Add company...</option>
                  {state.companies.filter(c => !relatedCompanies.some(rc => rc.id === c.id)).map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              {/* Contacts */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1">
                  <span>👤</span>
                  Contacts
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {relatedContacts.map(contact => (
                    <span
                      key={contact.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200"
                    >
                      👤 {contact.name}
                      <button
                        onClick={() => handleRemoveContact(contact.id)}
                        className="hover:text-gray-900 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddContact(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 bg-white"
                >
                  <option value="">+ Add contact...</option>
                  {state.contacts.filter(c => !relatedContacts.some(rc => rc.id === c.id)).map(contact => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </select>
              </div>

              {/* Topics */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block flex items-center gap-1">
                  <span>📌</span>
                  Topics
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {relatedTopics.map(topic => (
                    <span
                      key={topic.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200"
                    >
                      📌 {topic.name}
                      <button
                        onClick={() => handleRemoveTopic(topic.id)}
                        className="hover:text-gray-900 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddTopic(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 bg-white"
                >
                  <option value="">+ Add topic...</option>
                  {state.topics.filter(t => !relatedTopics.some(rt => rt.id === t.id)).map(topic => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Compact Tag Editor */}
        {isEditingTags && (
          <div className="bg-gray-50/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <TagIcon className="w-4 h-4" />
                Tags
              </h3>
              <button
                onClick={() => setIsEditingTags(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {note.tags && note.tags.length > 0 ? (
                note.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border border-gray-200"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-gray-900 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              ) : (
                <p className="text-xs text-gray-400 italic">No tags</p>
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
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 bg-white"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Key Takeaways - Compact Card */}
        {note.metadata?.keyPoints && note.metadata.keyPoints.length > 0 && (
          <div className="bg-cyan-50/60 backdrop-blur-sm rounded-xl p-4 border border-cyan-200/50">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-bold text-cyan-900 uppercase tracking-wide">Key Takeaways</h3>
            </div>
            <ul className="space-y-2">
              {note.metadata.keyPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-cyan-600 font-bold mt-0.5">•</span>
                  <span className="flex-1">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Main Content Editor - Natural Height */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Content</h2>
          <RichTextEditor
            content={formatNoteContent(editedContent)}
            onChange={setEditedContent}
            placeholder="Write your note here... Use the toolbar for rich formatting!"
            autoFocus={false}
            minimal={false}
          />
        </div>

        {/* Linked Tasks */}
        {linkedTasks.length > 0 && (
          <div className="bg-white/50 backdrop-blur-sm border border-gray-200/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  Linked Tasks ({linkedTasks.length})
                </h3>
              </div>
            </div>

            <div className="p-4 bg-white space-y-2">
              {linkedTasks.map((task) => (
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
              ))}
            </div>
          </div>
        )}

        {/* Related Topics */}
        {note.metadata?.relatedTopics && note.metadata.relatedTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-500 font-medium">Related:</span>
            {note.metadata.relatedTopics.map((relatedTopic, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-white/60 backdrop-blur-sm text-gray-700 rounded-lg text-xs font-medium border border-white/60"
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
            <div className="mt-3 bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50">
              <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {note.sourceText}
              </p>
            </div>
          </details>
        )}

        {/* Delete Button */}
        <div className="pt-6 border-t-2 border-gray-200/50 mt-8">
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-50/80 backdrop-blur-sm text-red-600 rounded-lg font-medium hover:bg-red-100 transition-all hover:scale-105 active:scale-95 text-sm flex items-center gap-2 border border-red-200/50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Note
          </button>
        </div>

        {/* Bottom padding for comfortable scrolling */}
        <div className="h-24" />
      </div>
    </div>
  );
}
