import { useState, useRef, useEffect, useMemo } from 'react';
import type { Note } from '../types';
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { FileText, Trash2, Clock, Sparkles, Columns, Focus, Settings } from 'lucide-react';
import { formatRelativeTime, generateId } from '../utils/helpers';
import { RichTextEditor } from './RichTextEditor';
import { InlineTagManager } from './InlineTagManager';
import { CompanyPillManager } from './CompanyPillManager';
import { ContactPillManager } from './ContactPillManager';
import { ICON_SIZES, getGlassClasses, getRadiusClass } from '../design-system/theme';
import { RelationshipModal } from './relationships/RelationshipModal';
import { RelationshipCardSection } from './relationships/RelationshipCardSection';
import { EntityType, RelationshipType } from '../types/relationships';

interface NoteDetailInlineProps {
  noteId: string;
  onToggleSidebar?: (expanded: boolean) => void;
  isSidebarExpanded?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NoteDetailInline({ noteId, onToggleSidebar, isSidebarExpanded }: NoteDetailInlineProps) {
  const { state: notesState, updateNote, deleteNote } = useNotes();
  const { state: entitiesState, addCompany, addContact } = useEntities();
  const { registerScrollContainer, unregisterScrollContainer } = useScrollAnimation();
  const [editedContent, setEditedContent] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [relationshipModalOpen, setRelationshipModalOpen] = useState(false);
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const rafIdRef = useRef<number | null>(null);

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

  // Register content container with ScrollAnimationContext and track scroll progress
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    // Register with context for global scroll coordination
    registerScrollContainer(contentElement);

    // RAF-based scroll handler for local animations
    const handleScroll = () => {
      // Cancel any pending RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Schedule update for next frame
      rafIdRef.current = requestAnimationFrame(() => {
        const scrollTop = contentElement.scrollTop;
        // Calculate progress from 0 to 1 over 200px of scrolling
        const progress = Math.min(scrollTop / 200, 1);
        setScrollProgress(progress);
        setIsScrolled(scrollTop > 100);
        rafIdRef.current = null;
      });
    };

    // Use passive listener for better scroll performance
    contentElement.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      // Cleanup: remove listener, cancel RAF, unregister from context
      contentElement.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      unregisterScrollContainer(contentElement);
    };
  }, [registerScrollContainer, unregisterScrollContainer]);

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

  const handleCompaniesChange = (companyIds: string[]) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      companyIds,
    };
    updateNote(updatedNote);
  };

  const handleContactsChange = (contactIds: string[]) => {
    if (!note) return;
    const updatedNote: Note = {
      ...note,
      contactIds,
    };
    updateNote(updatedNote);
  };

  // Entity creation callbacks
  const handleCreateCompany = async (name: string) => {
    const newCompany = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      noteCount: 0,
      profile: {},
    };
    addCompany(newCompany);
    return newCompany;
  };

  const handleCreateContact = async (name: string) => {
    const newContact = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      noteCount: 0,
      profile: {},
    };
    addContact(newContact);
    return newContact;
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
      <div className={`flex-shrink-0 ${getGlassClasses('medium')} border-b-2 px-8 py-6`}>
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
            className="overflow-visible transition-all duration-150"
            style={{
              maxHeight: `${Math.max(0, (1 - scrollProgress) * 200)}px`,
              opacity: Math.max(0, 1 - scrollProgress * 1.2),
            }}
          >
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

            {/* Companies & Contacts - Combined Row */}
            <div className="flex gap-4 mt-3 overflow-visible">
              {/* Companies Section */}
              <div className="flex-1 min-w-0 overflow-visible">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Companies
                </label>
                <CompanyPillManager
                  companyIds={note.companyIds || []}
                  onCompaniesChange={handleCompaniesChange}
                  allCompanies={entitiesState.companies}
                  editable={true}
                  onCreateCompany={handleCreateCompany}
                />
              </div>

              {/* Contacts Section */}
              <div className="flex-1 min-w-0 overflow-visible">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Contacts
                </label>
                <ContactPillManager
                  contactIds={note.contactIds || []}
                  onContactsChange={handleContactsChange}
                  allContacts={entitiesState.contacts}
                  editable={true}
                  onCreateContact={handleCreateContact}
                />
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="flex items-center gap-4 text-xs text-gray-600 mt-3">
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 ${getRadiusClass('pill')} ${getGlassClasses('subtle')} text-gray-600 capitalize font-medium`}>
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
                  w-11 h-11 ${getRadiusClass('pill')} transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center
                  ${isSidebarExpanded
                    ? `${getGlassClasses('subtle')} hover:bg-white/80 border-2 text-gray-700`
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
              className={`w-11 h-11 bg-red-100 hover:bg-red-200 ${getRadiusClass('pill')} transition-all hover:scale-105 active:scale-95 border-2 border-red-200 shadow-md flex items-center justify-center`}
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
          <div className={`bg-cyan-100/20 ${getGlassClasses('subtle')} ${getRadiusClass('card')} p-4`}>
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


        {/* Related Content Sections */}
        <div className="space-y-4">
          <RelationshipCardSection
            entityId={note.id}
            entityType={EntityType.NOTE}
            title="Related Tasks"
            filterTypes={[RelationshipType.TASK_NOTE]}
            maxVisible={8}
            variant="default"
            showActions={true}
            showExcerpts={false}
            onAddClick={() => setRelationshipModalOpen(true)}
          />

          <RelationshipCardSection
            entityId={note.id}
            entityType={EntityType.NOTE}
            title="Related Sessions"
            filterTypes={[RelationshipType.NOTE_SESSION]}
            maxVisible={8}
            variant="default"
            showActions={true}
            showExcerpts={false}
            onAddClick={() => setRelationshipModalOpen(true)}
          />
        </div>

        {/* Related Topics */}
        {note.metadata?.relatedTopics && note.metadata.relatedTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-500 font-medium">Related:</span>
            {note.metadata.relatedTopics.map((relatedTopic, idx) => (
              <span
                key={idx}
                className={`px-2.5 py-1 ${getGlassClasses('subtle')} text-gray-700 ${getRadiusClass('element')} text-xs font-medium`}
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
            <div className={`mt-3 ${getGlassClasses('medium')} ${getRadiusClass('field')} p-4`}>
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

      {/* Relationship Management Modal */}
      <RelationshipModal
        open={relationshipModalOpen}
        onClose={() => setRelationshipModalOpen(false)}
        entityId={note.id}
        entityType={EntityType.NOTE}
      />
    </div>
  );
}
