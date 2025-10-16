import { useState, useRef, useEffect, useMemo } from 'react';
import type { Note, Task } from '../types';
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';
import { useTasks } from '../context/TasksContext';
import { useUI } from '../context/UIContext';
import { Calendar, Tag as TagIcon, FileText, Trash2, Clock, CheckSquare, Link2, X, Sparkles, Plus, Columns, Focus } from 'lucide-react';
import { formatRelativeTime } from '../utils/helpers';
import { getTasksByNoteId } from '../utils/navigation';
import { RichTextEditor } from './RichTextEditor';
import { InlineTagManager } from './InlineTagManager';
import { ICON_SIZES } from '../design-system/theme';

interface NoteDetailInlineProps {
  noteId: string;
  onToggleSidebar?: (expanded: boolean) => void;
  isSidebarExpanded?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NoteDetailInline({ noteId, onToggleSidebar, isSidebarExpanded }: NoteDetailInlineProps) {
  const { state: notesState, updateNote, deleteNote } = useNotes();
  const { state: entitiesState } = useEntities();
  const { state: tasksState } = useTasks();
  const { dispatch: uiDispatch } = useUI();
  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Find the note from state
  const note = notesState.notes.find(n => n.id === noteId);

  // Get all related entities (companies, contacts, topics)
  const relatedCompanies = note ? entitiesState.companies.filter(c => note.companyIds?.includes(c.id)) : [];
  const relatedContacts = note ? entitiesState.contacts.filter(c => note.contactIds?.includes(c.id)) : [];
  const relatedTopics = note ? entitiesState.topics.filter(t => note.topicIds?.includes(t.id)) : [];

  // Legacy support
  if (note?.topicId) {
    const legacyCompany = entitiesState.companies.find(c => c.id === note.topicId);
    const legacyContact = entitiesState.contacts.find(c => c.id === note.topicId);
    const legacyTopic = entitiesState.topics.find(t => t.id === note.topicId);
    if (legacyCompany && !relatedCompanies.some(c => c.id === legacyCompany.id)) relatedCompanies.push(legacyCompany);
    if (legacyContact && !relatedContacts.some(c => c.id === legacyContact.id)) relatedContacts.push(legacyContact);
    if (legacyTopic && !relatedTopics.some(t => t.id === legacyTopic.id)) relatedTopics.push(legacyTopic);
  }

  // Get linked tasks
  const linkedTasks = noteId ? getTasksByNoteId(noteId, tasksState.tasks) : [];

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
      updateNote(updatedNote);
      setSaveStatus('saved');

      // Reset to idle after showing "saved" for 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    return () => clearTimeout(timer);
  }, [editedContent, editedSummary, noteId, updateNote]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingSummary && summaryInputRef.current) {
      summaryInputRef.current.focus();
      summaryInputRef.current.select();
    }
  }, [isEditingSummary]);

  // Track scroll progress for smooth animations
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const handleScroll = () => {
      const scrollTop = contentElement.scrollTop;
      // Calculate progress from 0 to 1 over 200px of scrolling
      const progress = Math.min(scrollTop / 200, 1);
      setScrollProgress(progress);
      setIsScrolled(scrollTop > 100);
    };

    contentElement.addEventListener('scroll', handleScroll);
    return () => contentElement.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDelete = () => {
    if (!note) return;
    if (confirm('Delete this note? This cannot be undone.')) {
      deleteNote(note.id);
    }
  };

  const handleTagsChange = (newTags: string[]) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      tags: newTags,
    };
    updateNote(updatedNote);
  };

  const handleAddCompany = (companyId: string) => {
    if (!note) return;
    const currentIds = note.companyIds || [];
    if (currentIds.includes(companyId)) return;
    const updatedNote: Note = {
      ...note,
      companyIds: [...currentIds, companyId],
    };
    updateNote(updatedNote);
  };

  const handleRemoveCompany = (companyId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      companyIds: (note.companyIds || []).filter(id => id !== companyId),
    };
    updateNote(updatedNote);
  };

  const handleAddContact = (contactId: string) => {
    if (!note) return;
    const currentIds = note.contactIds || [];
    if (currentIds.includes(contactId)) return;
    const updatedNote: Note = {
      ...note,
      contactIds: [...currentIds, contactId],
    };
    updateNote(updatedNote);
  };

  const handleRemoveContact = (contactId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      contactIds: (note.contactIds || []).filter(id => id !== contactId),
    };
    updateNote(updatedNote);
  };

  const handleAddTopic = (topicId: string) => {
    if (!note) return;
    const currentIds = note.topicIds || [];
    if (currentIds.includes(topicId)) return;
    const updatedNote: Note = {
      ...note,
      topicIds: [...currentIds, topicId],
    };
    updateNote(updatedNote);
  };

  const handleRemoveTopic = (topicId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      topicIds: (note.topicIds || []).filter(id => id !== topicId),
    };
    updateNote(updatedNote);
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Compact Header - Glass Morphism */}
      <div className="flex-shrink-0 bg-white/50 backdrop-blur-2xl border-b-2 border-white/60 shadow-lg px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-8">
          <div className="flex-1 min-w-0 space-y-3">
          {/* Title - Click to edit */}
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
              className={`font-bold text-gray-900 w-full border-b-2 border-cyan-500 focus:outline-none bg-transparent transition-all duration-300 ${
                isScrolled ? 'text-xl' : 'text-3xl'
              }`}
            />
          ) : (
            <h1
              onClick={() => setIsEditingSummary(true)}
              className={`font-bold text-gray-900 cursor-text hover:text-cyan-700 transition-all duration-300 ${
                isScrolled ? 'text-xl' : 'text-3xl'
              }`}
              title="Click to edit title"
            >
              {editedSummary}
            </h1>
          )}

          {/* Metadata Section - Collapsible on scroll */}
          <div
            className="overflow-hidden transition-all duration-150"
            style={{
              maxHeight: `${Math.max(0, (1 - scrollProgress) * 200)}px`,
              opacity: Math.max(0, 1 - scrollProgress * 1.2),
            }}
          >
            {/* Entity Relationships - Inline & Editable */}
            <InlineRelationshipManager
              relatedCompanies={relatedCompanies}
              relatedContacts={relatedContacts}
              relatedTopics={relatedTopics}
              onAddCompany={handleAddCompany}
              onRemoveCompany={handleRemoveCompany}
              onAddContact={handleAddContact}
              onRemoveContact={handleRemoveContact}
              onAddTopic={handleAddTopic}
              onRemoveTopic={handleRemoveTopic}
            />

            {/* Tags - Inline & Editable */}
            <div className="mt-3">
              <InlineTagManager
                tags={note.tags || []}
                onTagsChange={handleTagsChange}
                allTags={allTags}
                editable={true}
                className="min-h-[32px]"
              />
            </div>

            {/* Quick Stats Row */}
            <div className="flex items-center gap-4 text-xs text-gray-600 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-white/60 text-gray-600 capitalize font-medium">
                  {note.source}
                </span>
              </div>
              {note.metadata?.sentiment && (
                <div className="flex items-center gap-1">
                  <span>
                    {note.metadata.sentiment === 'positive' ? '😊 Positive' :
                     note.metadata.sentiment === 'negative' ? '😞 Negative' : '😐 Neutral'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                <span>{formatRelativeTime(note.timestamp)}</span>
              </div>
              {linkedTasks.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <CheckSquare size={14} />
                  <span>{linkedTasks.length} {linkedTasks.length === 1 ? 'task' : 'tasks'}</span>
                </div>
              )}
              <div className="ml-auto">
                {renderSaveStatus()}
              </div>
            </div>
          </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onToggleSidebar && (
              <button
                onClick={() => onToggleSidebar(!isSidebarExpanded)}
                className={`
                  w-11 h-11 rounded-full transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center
                  ${isSidebarExpanded
                    ? 'bg-white/60 hover:bg-white/80 border-2 border-white/60 text-gray-700'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 border-2 border-cyan-400 text-white shadow-cyan-200/50'
                  }
                `}
                title={isSidebarExpanded ? "List View" : "Focus Mode (currently active)"}
              >
                {isSidebarExpanded ? (
                  <Columns size={ICON_SIZES.md} />
                ) : (
                  <Focus size={ICON_SIZES.md} />
                )}
              </button>
            )}
            <button
              onClick={handleDelete}
              className="w-11 h-11 bg-red-100 hover:bg-red-200 rounded-full transition-all hover:scale-105 active:scale-95 border-2 border-red-200 shadow-md flex items-center justify-center"
              title="Delete note"
            >
              <Trash2 size={20} className="text-red-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-8 py-6 max-w-5xl mx-auto space-y-4">

        {/* Key Takeaways - Compact Card */}
        {note.metadata?.keyPoints && note.metadata.keyPoints.length > 0 && (
          <div className="bg-cyan-100/20 backdrop-blur-sm rounded-[24px] p-4 border border-cyan-200/50">
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
            content={editedContent}
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
                  onClick={() => uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: task.id, label: task.title } })}
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
                className="px-2.5 py-1 bg-white/30 backdrop-blur-sm text-gray-700 rounded-[16px] text-xs font-medium border border-white/60"
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

        {/* Bottom padding for comfortable scrolling */}
        <div className="h-24" />
        </div>
      </div>
    </div>
  );
}

// Inline Relationship Manager Component - Click to edit relationships inline
interface InlineRelationshipManagerProps {
  relatedCompanies: Array<{ id: string; name: string }>;
  relatedContacts: Array<{ id: string; name: string }>;
  relatedTopics: Array<{ id: string; name: string }>;
  onAddCompany: (companyId: string) => void;
  onRemoveCompany: (companyId: string) => void;
  onAddContact: (contactId: string) => void;
  onRemoveContact: (contactId: string) => void;
  onAddTopic: (topicId: string) => void;
  onRemoveTopic: (topicId: string) => void;
}

function InlineRelationshipManager({
  relatedCompanies,
  relatedContacts,
  relatedTopics,
  onAddCompany,
  onRemoveCompany,
  onAddContact,
  onRemoveContact,
  onAddTopic,
  onRemoveTopic,
}: InlineRelationshipManagerProps) {
  const { state: entitiesState } = useEntities();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  const handleAddCompany = (companyId: string) => {
    if (!companyId) return;
    onAddCompany(companyId);
    setSelectedCompanyId('');
  };

  const handleAddContact = (contactId: string) => {
    if (!contactId) return;
    onAddContact(contactId);
    setSelectedContactId('');
  };

  const handleAddTopic = (topicId: string) => {
    if (!topicId) return;
    onAddTopic(topicId);
    setSelectedTopicId('');
  };

  const hasRelationships = relatedCompanies.length > 0 || relatedContacts.length > 0 || relatedTopics.length > 0;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Companies Dropdown */}
        <select
          value={selectedCompanyId}
          onChange={(e) => {
            setSelectedCompanyId(e.target.value);
            handleAddCompany(e.target.value);
          }}
          className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border-2 border-blue-400 rounded-full text-xs font-semibold text-gray-800 outline-none"
        >
          <option value="">+ Company...</option>
          {entitiesState.companies.filter(c => !relatedCompanies.some(rc => rc.id === c.id)).map(company => (
            <option key={company.id} value={company.id}>🏢 {company.name}</option>
          ))}
        </select>

        {/* Contacts Dropdown */}
        <select
          value={selectedContactId}
          onChange={(e) => {
            setSelectedContactId(e.target.value);
            handleAddContact(e.target.value);
          }}
          className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border-2 border-emerald-400 rounded-full text-xs font-semibold text-gray-800 outline-none"
        >
          <option value="">+ Contact...</option>
          {entitiesState.contacts.filter(c => !relatedContacts.some(rc => rc.id === c.id)).map(contact => (
            <option key={contact.id} value={contact.id}>👤 {contact.name}</option>
          ))}
        </select>

        {/* Topics Dropdown */}
        <select
          value={selectedTopicId}
          onChange={(e) => {
            setSelectedTopicId(e.target.value);
            handleAddTopic(e.target.value);
          }}
          className="px-3 py-1.5 bg-white/80 backdrop-blur-sm border-2 border-amber-400 rounded-full text-xs font-semibold text-gray-800 outline-none"
        >
          <option value="">+ Topic...</option>
          {entitiesState.topics.filter(t => !relatedTopics.some(rt => rt.id === t.id)).map(topic => (
            <option key={topic.id} value={topic.id}>📌 {topic.name}</option>
          ))}
        </select>

        <button
          onClick={() => setIsEditing(false)}
          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full text-xs font-semibold transition-all"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
      {/* Company Pills */}
      {relatedCompanies.map(company => (
        <button
          key={company.id}
          onClick={() => setIsEditing(true)}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-100/80 to-cyan-100/80 hover:from-blue-200/90 hover:to-cyan-200/90 border border-blue-300/60 rounded-full text-xs font-semibold text-blue-800 transition-all"
        >
          <span>🏢</span>
          <span>{company.name}</span>
          <X
            className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveCompany(company.id);
            }}
          />
        </button>
      ))}

      {/* Contact Pills */}
      {relatedContacts.map(contact => (
        <button
          key={contact.id}
          onClick={() => setIsEditing(true)}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-100/80 to-green-100/80 hover:from-emerald-200/90 hover:to-green-200/90 border border-emerald-300/60 rounded-full text-xs font-semibold text-emerald-800 transition-all"
        >
          <span>👤</span>
          <span>{contact.name}</span>
          <X
            className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveContact(contact.id);
            }}
          />
        </button>
      ))}

      {/* Topic Pills */}
      {relatedTopics.map(topic => (
        <button
          key={topic.id}
          onClick={() => setIsEditing(true)}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-100/80 to-yellow-100/80 hover:from-amber-200/90 hover:to-yellow-200/90 border border-amber-300/60 rounded-full text-xs font-semibold text-amber-800 transition-all"
        >
          <span>📌</span>
          <span>{topic.name}</span>
          <X
            className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTopic(topic.id);
            }}
          />
        </button>
      ))}

      {/* Add Button - Only show if no relationships */}
      {!hasRelationships && (
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/40 hover:bg-white/60 border border-dashed border-gray-400 hover:border-cyan-400 rounded-full text-xs text-gray-500 hover:text-cyan-700 font-medium transition-all"
        >
          <Plus size={12} />
          <span>Add Relationships</span>
        </button>
      )}
    </div>
  );
}
