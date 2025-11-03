import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Note, Topic, Company, Contact } from '../types';
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { FileText, Trash2, Clock, Sparkles, Columns, Focus, Settings, CheckCircle2, Edit3 } from 'lucide-react';
import { formatRelativeTime, generateId } from '../utils/helpers';
import { RichTextEditor } from './RichTextEditor';
import { InlineTagManager } from './InlineTagManager';
import { CompanyPillManager } from './CompanyPillManager';
import { ContactPillManager } from './ContactPillManager';
import { ICON_SIZES, getGlassClasses, getRadiusClass } from '../design-system/theme';
import { RelationshipModal } from './relationships/RelationshipModal';
import { RelationshipCardSection } from './relationships/RelationshipCardSection';
import { EntityType, RelationshipType } from '../types/relationships';
import { NoteEnrichmentButton } from './notes/NoteEnrichmentButton';
import { NoteEnrichmentSuggestions, type SuggestionType } from './notes/NoteEnrichmentSuggestions';
import { getNoteEnrichmentService, type NoteEnrichmentResult } from '../services/noteEnrichmentService';

interface NoteDetailInlineProps {
  noteId: string;
  onToggleSidebar?: (expanded: boolean) => void;
  isSidebarExpanded?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function NoteDetailInline({ noteId, onToggleSidebar, isSidebarExpanded }: NoteDetailInlineProps) {
  const { state: notesState, updateNote, deleteNote } = useNotes();
  const { state: entitiesState, addCompany, addContact, addTopic } = useEntities();
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

  // Enrichment state
  const [enrichmentResult, setEnrichmentResult] = useState<NoteEnrichmentResult | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const autoEnrichedNotesRef = useRef<Set<string>>(new Set());
  const enrichmentService = getNoteEnrichmentService();

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

  // Compute companyIds from relationships
  const noteCompanyIds = useMemo(() => {
    if (!note) return [];
    return note.relationships
      .filter(r => r.targetType === EntityType.COMPANY)
      .map(r => r.targetId);
  }, [note?.relationships]);

  // Compute contactIds from relationships
  const noteContactIds = useMemo(() => {
    if (!note) return [];
    return note.relationships
      .filter(r => r.targetType === EntityType.CONTACT)
      .map(r => r.targetId);
  }, [note?.relationships]);

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

  const handleToggleStatus = () => {
    if (!note) return;
    const newStatus = note.status === 'approved' ? 'draft' : 'approved';
    const updatedNote: Note = {
      ...note,
      status: newStatus,
      lastUpdated: new Date().toISOString(),
    };
    updateNote(updatedNote);
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

    // Remove all existing company relationships
    const nonCompanyRelationships = note.relationships.filter(
      r => r.targetType !== EntityType.COMPANY
    );

    // Add new company relationships
    const newCompanyRelationships = companyIds.map(companyId => ({
      id: generateId(),
      sourceType: EntityType.NOTE,
      sourceId: note.id,
      targetType: EntityType.COMPANY,
      targetId: companyId,
      type: RelationshipType.NOTE_COMPANY,
      canonical: true,
      metadata: { source: 'manual' as const, createdAt: new Date().toISOString() },
    }));

    const updatedNote: Note = {
      ...note,
      relationships: [...nonCompanyRelationships, ...newCompanyRelationships],
    };
    updateNote(updatedNote);
  };

  const handleContactsChange = (contactIds: string[]) => {
    if (!note) return;

    // Remove all existing contact relationships
    const nonContactRelationships = note.relationships.filter(
      r => r.targetType !== EntityType.CONTACT
    );

    // Add new contact relationships
    const newContactRelationships = contactIds.map(contactId => ({
      id: generateId(),
      sourceType: EntityType.NOTE,
      sourceId: note.id,
      targetType: EntityType.CONTACT,
      targetId: contactId,
      type: RelationshipType.NOTE_CONTACT,
      canonical: true,
      metadata: { source: 'manual' as const, createdAt: new Date().toISOString() },
    }));

    const updatedNote: Note = {
      ...note,
      relationships: [...nonContactRelationships, ...newContactRelationships],
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

  // Auto-enrichment trigger: enrich note when content is saved and hasn't been auto-enriched yet
  useEffect(() => {
    if (!note || !noteId) return;

    // Skip if already auto-enriched
    if (autoEnrichedNotesRef.current.has(noteId)) return;

    // Skip if already has enrichment
    if (note.metadata?.aiEnrichment) return;

    // Skip if content is too short (< 50 characters)
    if (!note.content || note.content.trim().length < 50) return;

    // Only trigger after content has been edited and saved
    if (saveStatus === 'saved') {
      // Mark as auto-enriched to prevent re-trigger
      autoEnrichedNotesRef.current.add(noteId);

      // Trigger enrichment in background
      handleEnrichNote(true);
    }
  }, [saveStatus, noteId, note?.metadata?.aiEnrichment]);

  // Manual or auto enrichment handler
  const handleEnrichNote = useCallback(async (autoTriggered = false) => {
    if (!note || isEnriching) return;

    setIsEnriching(true);
    setEnrichmentResult(null);

    try {
      const result = await enrichmentService.enrichNote(
        note,
        {
          existingNotes: notesState.notes,
          existingTopics: entitiesState.topics,
          existingCompanies: entitiesState.companies,
          existingContacts: entitiesState.contacts,
        },
        {
          generateTitle: true,
          extractTags: true,
          generateSummary: true,
          findRelations: true,
          analyzeEntities: true,
        }
      );

      if (result.success) {
        setEnrichmentResult(result);

        // Update note with enrichment metadata
        const updatedNote: Note = {
          ...note,
          metadata: {
            ...note.metadata,
            aiEnrichment: {
              enrichedAt: new Date().toISOString(),
              model: 'claude-sonnet-4-5',
              autoEnriched: autoTriggered,
              suggestedTitle: result.suggestedTitle,
              suggestedTags: result.suggestedTags,
              suggestedSummary: result.suggestedSummary,
              keyTopics: result.keyTopics,
              sentiment: result.sentiment,
              relatedNoteIds: result.relatedNoteIds,
              suggestedCompanyIds: result.suggestedCompanyIds,
              suggestedContactIds: result.suggestedContactIds,
              suggestedTopicIds: result.suggestedTopicIds,
              newCompanies: result.newCompanies,
              newContacts: result.newContacts,
              newTopics: result.newTopics,
            },
          },
        };
        updateNote(updatedNote);
      } else {
        console.error('[NOTE ENRICHMENT] Enrichment failed:', result.error);
      }
    } catch (error) {
      console.error('[NOTE ENRICHMENT] Enrichment error:', error);
    } finally {
      setIsEnriching(false);
    }
  }, [note, isEnriching, enrichmentService, notesState.notes, entitiesState, updateNote]);

  // Apply enrichment suggestion
  const handleApplySuggestion = useCallback((type: SuggestionType, value: any) => {
    if (!note) return;

    let updatedNote = { ...note };

    switch (type) {
      case 'title':
        updatedNote.summary = value;
        setEditedSummary(value);
        break;

      case 'tags':
        updatedNote.tags = value;
        break;

      case 'summary':
        // Store summary in metadata if not already the title
        updatedNote.metadata = {
          ...updatedNote.metadata,
          keyPoints: [value],
        };
        break;

      case 'linkCompany':
        updatedNote.relationships = [...updatedNote.relationships, {
          id: generateId(),
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.COMPANY,
          targetId: value,
          type: RelationshipType.NOTE_COMPANY,
          canonical: true,
          metadata: { source: 'ai' as const, createdAt: new Date().toISOString() },
        }];
        break;

      case 'linkContact':
        updatedNote.relationships = [...updatedNote.relationships, {
          id: generateId(),
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.CONTACT,
          targetId: value,
          type: RelationshipType.NOTE_CONTACT,
          canonical: true,
          metadata: { source: 'ai' as const, createdAt: new Date().toISOString() },
        }];
        break;

      case 'linkTopic':
        updatedNote.relationships = [...updatedNote.relationships, {
          id: generateId(),
          sourceType: EntityType.NOTE,
          sourceId: note.id,
          targetType: EntityType.TOPIC,
          targetId: value,
          type: RelationshipType.NOTE_TOPIC,
          canonical: true,
          metadata: { source: 'ai' as const, createdAt: new Date().toISOString() },
        }];
        break;

      case 'createCompany':
        {
          const newCompany: Company = {
            id: generateId(),
            name: value.name,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            noteCount: 0,
            profile: {
              description: value.description,
            },
          };
          addCompany(newCompany);
          updatedNote.relationships = [...updatedNote.relationships, {
            id: generateId(),
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.COMPANY,
            targetId: newCompany.id,
            type: RelationshipType.NOTE_COMPANY,
            canonical: true,
            metadata: { source: 'ai' as const, createdAt: new Date().toISOString() },
          }];
        }
        break;

      case 'createContact':
        {
          const newContact: Contact = {
            id: generateId(),
            name: value.name,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            noteCount: 0,
            profile: {
              email: value.email,
              role: value.role,
            },
          };
          addContact(newContact);
          updatedNote.relationships = [...updatedNote.relationships, {
            id: generateId(),
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.CONTACT,
            targetId: newContact.id,
            type: RelationshipType.NOTE_CONTACT,
            canonical: true,
            metadata: { source: 'ai' as const, createdAt: new Date().toISOString() },
          }];
        }
        break;

      case 'createTopic':
        {
          const newTopic: Topic = {
            id: generateId(),
            name: value.name,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            noteCount: 0,
          };
          addTopic(newTopic);
          updatedNote.relationships = [...updatedNote.relationships, {
            id: generateId(),
            sourceType: EntityType.NOTE,
            sourceId: note.id,
            targetType: EntityType.TOPIC,
            targetId: newTopic.id,
            type: RelationshipType.NOTE_TOPIC,
            canonical: true,
            metadata: { source: 'ai' as const, createdAt: new Date().toISOString() },
          }];
        }
        break;
    }

    updateNote(updatedNote);
  }, [note, updateNote, addCompany, addContact, addTopic]);

  // Dismiss enrichment suggestions
  const handleDismissSuggestions = useCallback(() => {
    setEnrichmentResult(null);
  }, []);

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
                  companyIds={noteCompanyIds}
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
                  contactIds={noteContactIds}
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

              {/* Status Toggle */}
              <button
                onClick={handleToggleStatus}
                className={`flex items-center gap-1.5 px-2 py-0.5 ${getRadiusClass('pill')} transition-all hover:scale-105 active:scale-95 font-medium ${
                  note.status === 'approved'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                }`}
                title={note.status === 'approved' ? 'Click to mark as draft' : 'Click to approve'}
              >
                {note.status === 'approved' ? (
                  <>
                    <CheckCircle2 size={12} />
                    <span>Approved</span>
                  </>
                ) : (
                  <>
                    <Edit3 size={12} />
                    <span>Draft</span>
                  </>
                )}
              </button>

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
            <NoteEnrichmentButton
              note={note}
              onEnrich={() => handleEnrichNote(false)}
              disabled={isEnriching}
            />
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

        {/* Enrichment Suggestions */}
        {enrichmentResult && (
          <NoteEnrichmentSuggestions
            note={note}
            enrichment={enrichmentResult}
            existingTopics={entitiesState.topics}
            existingCompanies={entitiesState.companies}
            existingContacts={entitiesState.contacts}
            onApplySuggestion={handleApplySuggestion}
            onDismiss={handleDismissSuggestions}
          />
        )}

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
