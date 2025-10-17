import { useState, useRef, useEffect, useMemo } from 'react';
import type { Note, Task, Company, Contact, Topic } from '../types';
import { useNotes } from '../context/NotesContext';
import { useTasks } from '../context/TasksContext';
import { useEntities } from '../context/EntitiesContext';
import { useUI } from '../context/UIContext';
import { Calendar, Tag as TagIcon, FileText, Trash2, ChevronDown, ChevronUp, Clock, Phone, Mail, MessageSquare, User, CheckSquare, Link2, Plus, X, MoreHorizontal, Sparkles, Building2, UserCircle, Bookmark } from 'lucide-react';
import { formatRelativeTime, generateNoteTitle, formatNoteContent } from '../utils/helpers';
import { getTasksByNoteId } from '../utils/navigation';
import { RichTextEditor } from './RichTextEditor';
import { InlineTagManager } from './InlineTagManager';
import { ConfirmDialog } from './ConfirmDialog';
import {
  MODAL_OVERLAY,
  getGlassClasses,
  getRadiusClass,
  getInfoGradient,
  getDangerGradient,
  getEntityPillClasses,
  getWarningGradient,
  getStatusBadgeClasses,
  getSuccessGradient,
} from '../design-system/theme';

interface NoteDetailSidebarProps {
  noteId: string | undefined;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NoteDetailSidebar({ noteId }: NoteDetailSidebarProps) {
  const { state: notesState, dispatch: notesDispatch } = useNotes();
  const { state: tasksState } = useTasks();
  const { state: entitiesState } = useEntities();
  const { state: uiState, dispatch: uiDispatch } = useUI();

  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');

  const [showTimeline, setShowTimeline] = useState(true);
  const [showLinkedTasks, setShowLinkedTasks] = useState(true);
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  // Find the note from state
  const note = notesState.notes.find(n => n.id === noteId);
  const topic = note ? entitiesState.topics.find(t => t.id === note.topicId) : undefined;

  // Get all related entities (companies, contacts, topics)
  const relatedCompanies = note ? entitiesState.companies.filter(c => note.companyIds?.includes(c.id)) : [];
  const relatedContacts = note ? entitiesState.contacts.filter(c => note.contactIds?.includes(c.id)) : [];
  const relatedTopics = note ? entitiesState.topics.filter(t => note.topicIds?.includes(t.id)) : [];

  // Legacy support for single topicId
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

  const handleTopicChange = (newTopicId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      topicId: newTopicId,
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleTagsChange = (newTags: string[]) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      tags: newTags,
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleAddCompany = (companyId: string) => {
    if (!note) return;
    const currentIds = note.companyIds || [];
    if (currentIds.includes(companyId)) return;
    const updatedNote: Note = {
      ...note,
      companyIds: [...currentIds, companyId],
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleRemoveCompany = (companyId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      companyIds: (note.companyIds || []).filter(id => id !== companyId),
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleAddContact = (contactId: string) => {
    if (!note) return;
    const currentIds = note.contactIds || [];
    if (currentIds.includes(contactId)) return;
    const updatedNote: Note = {
      ...note,
      contactIds: [...currentIds, contactId],
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleRemoveContact = (contactId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      contactIds: (note.contactIds || []).filter(id => id !== contactId),
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleAddTopic = (topicId: string) => {
    if (!note) return;
    const currentIds = note.topicIds || [];
    if (currentIds.includes(topicId)) return;
    const updatedNote: Note = {
      ...note,
      topicIds: [...currentIds, topicId],
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
  };

  const handleRemoveTopic = (topicId: string) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      topicIds: (note.topicIds || []).filter(id => id !== topicId),
    };
    notesDispatch({ type: 'UPDATE_NOTE', payload: updatedNote });
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
      todo: { label: 'To Do' },
      'in-progress': { label: 'In Progress' },
      done: { label: 'Done' },
      blocked: { label: 'Blocked' },
    };
    const badge = badges[status];
    return (
      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getStatusBadgeClasses(status)}`}>
        {badge.label}
      </span>
    );
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

          {/* Relationships - Companies, Contacts, Topics */}
          <div className="mb-2">
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
          </div>

          {/* Tags - Inline Manager */}
          <div className="mb-0">
            <InlineTagManager
              tags={note.tags || []}
              onTagsChange={handleTagsChange}
              allTags={allTags}
              editable={true}
              className="min-h-[32px]"
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

          {/* Linked Tasks - Modern Glass Container */}
          {linkedTasks.length > 0 && (
            <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} overflow-hidden`}>
              <div className={`${getSuccessGradient('light').container} px-5 py-4 border-b-2 border-white/30`}>
                <div className="flex items-center gap-2">
                  <CheckSquare className={`w-5 h-5 ${getSuccessGradient('light').iconColor}`} />
                  <h3 className={`text-sm font-bold uppercase tracking-wide ${getSuccessGradient('light').textPrimary}`}>
                    Linked Tasks ({linkedTasks.length})
                  </h3>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {linkedTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: task.id, label: task.title } })}
                    className={`${getGlassClasses('subtle')} ${getRadiusClass('element')} hover:border-cyan-300 p-4 transition-all duration-300 hover:scale-[1.01] cursor-pointer`}
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
    </>
  );
}

// Inline Relationship Manager Component - Click to edit relationships inline
interface InlineRelationshipManagerProps {
  relatedCompanies: Company[];
  relatedContacts: Contact[];
  relatedTopics: Topic[];
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
          className={`px-3 py-1.5 ${getGlassClasses('medium')} border-2 ${getEntityPillClasses('company')} rounded-full text-xs font-semibold text-gray-800 outline-none`}
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
          className={`px-3 py-1.5 ${getGlassClasses('medium')} border-2 ${getEntityPillClasses('contact')} rounded-full text-xs font-semibold text-gray-800 outline-none`}
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
          className={`px-3 py-1.5 ${getGlassClasses('medium')} border-2 ${getEntityPillClasses('topic')} rounded-full text-xs font-semibold text-gray-800 outline-none`}
        >
          <option value="">+ Topic...</option>
          {entitiesState.topics.filter(t => !relatedTopics.some(rt => rt.id === t.id)).map(topic => (
            <option key={topic.id} value={topic.id}>📌 {topic.name}</option>
          ))}
        </select>

        <button
          onClick={() => setIsEditing(false)}
          className={`px-3 py-1.5 ${getInfoGradient('medium').container} text-white rounded-full text-xs font-semibold transition-all`}
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
          className={`group inline-flex items-center gap-1.5 px-3 py-1.5 ${getEntityPillClasses('company')} hover:from-blue-200/90 hover:to-cyan-200/90 rounded-full text-xs font-semibold transition-all shadow-sm`}
        >
          <Building2 className="w-3 h-3" />
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
          className={`group inline-flex items-center gap-1.5 px-3 py-1.5 ${getEntityPillClasses('contact')} hover:from-emerald-200/90 hover:to-green-200/90 rounded-full text-xs font-semibold transition-all shadow-sm`}
        >
          <UserCircle className="w-3 h-3" />
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
          className={`group inline-flex items-center gap-1.5 px-3 py-1.5 ${getEntityPillClasses('topic')} hover:from-amber-200/90 hover:to-yellow-200/90 rounded-full text-xs font-semibold transition-all shadow-sm`}
        >
          <Bookmark className="w-3 h-3" />
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
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${getGlassClasses('subtle')} border border-dashed border-gray-400 hover:border-cyan-400 rounded-full text-xs text-gray-500 hover:text-cyan-700 font-medium transition-all`}
        >
          <Plus size={12} />
          <span>Add Relationships</span>
        </button>
      )}
    </div>
  );
}
