import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';
import { useTasks } from '../context/TasksContext';
import { useUI } from '../context/UIContext';
import { sortTopics, formatRelativeTime, truncateText, generateNoteTitle, generateId } from '../utils/helpers';
import { Clock, FileText, Search, X, SlidersHorizontal, CheckSquare, Plus } from 'lucide-react';
import { NoteDetailInline } from './NoteDetailInline';
import { Input } from './Input';
import { SpaceMenuBar } from './SpaceMenuBar';
import { StandardFilterPanel } from './StandardFilterPanel';
import { InlineTagManager } from './InlineTagManager';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import type { Note } from '../types';

export default function LibraryZone() {
  const { state: notesState, dispatch: notesDispatch } = useNotes();
  const { state: entitiesState } = useEntities();
  const { state: tasksState } = useTasks();
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>();
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>();
  const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<('call' | 'email' | 'thought' | 'other')[]>([]);
  const [selectedSentiments, setSelectedSentiments] = useState<('positive' | 'neutral' | 'negative')[]>([]);
  const [sortBy] = useState<'recent' | 'name' | 'noteCount'>('recent');
  const [noteSortBy, setNoteSortBy] = useState<'recent' | 'oldest' | 'alphabetical'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNoteIdForInline, setSelectedNoteIdForInline] = useState<string | undefined>();

  // Sidebar collapse state
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1280;
    }
    return true;
  });
  const [collapseReason, setCollapseReason] = useState<'manual' | 'auto' | null>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1280 ? 'auto' : null;
    }
    return null;
  });

  // Sidebar toggle handlers
  const handleSidebarToggle = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
    setCollapseReason(expanded ? null : 'manual');
  };

  const handleSidebarProgrammatic = (expanded: boolean, reason: 'auto' | null = 'auto') => {
    setIsSidebarExpanded(expanded);
    setCollapseReason(reason);
  };

  // Responsive auto-collapse/expand based on window size
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1280;

      if (isLargeScreen) {
        // Auto-expand ONLY if it was auto-collapsed
        if (!isSidebarExpanded && collapseReason === 'auto') {
          setIsSidebarExpanded(true);
          setCollapseReason(null);
        }
      } else {
        // Auto-collapse on small screens
        if (isSidebarExpanded) {
          setIsSidebarExpanded(false);
          setCollapseReason('auto');
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarExpanded, collapseReason]);

  // Listen for activeNoteId changes (for modal opening)
  useEffect(() => {
    if (uiState.activeNoteId) {
      const note = notesState.notes.find(n => n.id === uiState.activeNoteId);
      if (note) {
        uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
        uiDispatch({ type: 'SET_ACTIVE_NOTE', payload: undefined });
      }
    }
  }, [uiState.activeNoteId, notesState.notes, uiDispatch]);

  const sortedCompanies = useMemo(() => {
    return [...entitiesState.companies].sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.noteCount - a.noteCount;
    });
  }, [entitiesState.companies, sortBy]);

  const sortedContacts = useMemo(() => {
    return [...entitiesState.contacts].sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.noteCount - a.noteCount;
    });
  }, [entitiesState.contacts, sortBy]);

  const sortedTopics = useMemo(() => sortTopics(entitiesState.topics, sortBy), [entitiesState.topics, sortBy]);

  // Extract all unique tags from notes with counts
  const allTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    notesState.notes.forEach(note => {
      note.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [notesState.notes]);

  const displayedNotes = useMemo(() => {
    let notes = notesState.notes;

    // Filter by company
    if (selectedCompanyId) {
      notes = notes.filter(note =>
        note.companyIds?.includes(selectedCompanyId) ||
        (note.topicId === selectedCompanyId) // Legacy support
      );
    }

    // Filter by contact
    if (selectedContactId) {
      notes = notes.filter(note =>
        note.contactIds?.includes(selectedContactId) ||
        (note.topicId === selectedContactId) // Legacy support
      );
    }

    // Filter by topic
    if (selectedTopicId) {
      notes = notes.filter(note =>
        note.topicIds?.includes(selectedTopicId) ||
        (note.topicId === selectedTopicId) // Legacy support
      );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      notes = notes.filter(note =>
        selectedTags.every(selectedTag =>
          note.tags?.some(tag => tag.toLowerCase() === selectedTag.toLowerCase())
        )
      );
    }

    // Apply source filter
    if (selectedSources.length > 0) {
      notes = notes.filter(note =>
        note.source && selectedSources.includes(note.source)
      );
    }

    // Apply sentiment filter
    if (selectedSentiments.length > 0) {
      notes = notes.filter(note =>
        note.metadata?.sentiment && selectedSentiments.includes(note.metadata.sentiment)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      notes = notes.filter(note =>
        note.content.toLowerCase().includes(query) ||
        note.summary.toLowerCase().includes(query) ||
        note.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        (note.metadata?.keyPoints?.some(point => point.toLowerCase().includes(query))) ||
        (note.metadata?.relatedTopics?.some(topic => topic.toLowerCase().includes(query)))
      );
    }

    // Sort notes
    const sorted = [...notes].sort((a, b) => {
      if (noteSortBy === 'recent') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      } else if (noteSortBy === 'oldest') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else {
        return a.summary.localeCompare(b.summary);
      }
    });

    return sorted;
  }, [notesState.notes, selectedCompanyId, selectedContactId, selectedTopicId, selectedTags, selectedSources, selectedSentiments, searchQuery, noteSortBy]);

  // Auto-select first note when displayedNotes changes
  useEffect(() => {
    if (displayedNotes.length > 0 && !selectedNoteIdForInline) {
      setSelectedNoteIdForInline(displayedNotes[0].id);
    }
  }, [displayedNotes, selectedNoteIdForInline]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const activeFiltersCount = (selectedCompanyId ? 1 : 0) + (selectedContactId ? 1 : 0) + (selectedTopicId ? 1 : 0) + selectedTags.length + selectedSources.length + selectedSentiments.length + (searchQuery ? 1 : 0);

  const handleNoteClick = useCallback((noteId: string, e: React.MouseEvent) => {
    // If Cmd/Ctrl is held, open in modal instead
    if (e.metaKey || e.ctrlKey) {
      const note = notesState.notes.find(n => n.id === noteId);
      if (note) {
        uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
      }
    } else {
      setSelectedNoteIdForInline(noteId);
    }
  }, [notesState.notes, uiDispatch]);

  const handleCreateNewNote = useCallback(() => {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: generateId(),
      content: '',
      summary: 'New Note',
      timestamp: now,
      lastUpdated: now,
      source: 'thought',
      tags: [],
    };

    notesDispatch({ type: 'ADD_NOTE', payload: newNote });
    setSelectedNoteIdForInline(newNote.id);
  }, [notesDispatch]);

  return (
    <div className="h-full w-full relative flex flex-col bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20">
      {/* Secondary animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none will-change-transform" />

      <div className="relative z-10 flex-1 min-h-0 flex flex-col pt-24 px-6 pb-6">
        {/* Header - Menu Bar */}
        <SpaceMenuBar
          primaryAction={{
            label: 'New Note',
            icon: <Plus size={16} />,
            onClick: handleCreateNewNote,
            gradient: 'purple',
          }}
          dropdowns={[
            {
              label: 'Sort',
              value: noteSortBy,
              options: [
                { value: 'recent', label: 'Recent' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'alphabetical', label: 'A-Z' },
              ],
              onChange: (value) => setNoteSortBy(value as typeof noteSortBy),
            },
          ]}
          filters={{
            active: showFilters,
            count: [
              selectedCompanyId ? 1 : 0,
              selectedContactId ? 1 : 0,
              selectedTopicId ? 1 : 0,
              selectedTags.length,
            ].reduce((a, b) => a + b, 0),
            onToggle: () => setShowFilters(!showFilters),
            panel: showFilters ? (
              <StandardFilterPanel
                title="Filter Notes"
                sections={[
                  {
                    title: 'COMPANIES',
                    items: sortedCompanies.map(c => ({ id: c.id, label: c.name })),
                    selectedIds: selectedCompanyId ? [selectedCompanyId] : [],
                    onToggle: (id) => setSelectedCompanyId(id === selectedCompanyId ? undefined : id),
                    multiSelect: false,
                  },
                  {
                    title: 'CONTACTS',
                    items: sortedContacts.map(c => ({ id: c.id, label: c.name })),
                    selectedIds: selectedContactId ? [selectedContactId] : [],
                    onToggle: (id) => setSelectedContactId(id === selectedContactId ? undefined : id),
                    multiSelect: false,
                  },
                  {
                    title: 'TOPICS',
                    items: sortedTopics.map(t => ({ id: t.id, label: t.name })),
                    selectedIds: selectedTopicId ? [selectedTopicId] : [],
                    onToggle: (id) => setSelectedTopicId(id === selectedTopicId ? undefined : id),
                    multiSelect: false,
                  },
                  {
                    title: 'TAGS',
                    items: allTags.slice(0, 8).map(({ tag }) => ({ id: tag, label: `#${tag}` })),
                    selectedIds: selectedTags,
                    onToggle: toggleTag,
                    multiSelect: true,
                  },
                ]}
                onClearAll={() => {
                  setSelectedCompanyId(undefined);
                  setSelectedContactId(undefined);
                  setSelectedTopicId(undefined);
                  setSelectedTags([]);
                  setSelectedSources([]);
                  setSelectedSentiments([]);
                }}
              />
            ) : undefined,
          }}
          stats={{
            total: notesState.notes.length,
            filtered: displayedNotes.length,
          }}
        />

        {/* Split-screen Layout */}
        <div className="flex-1 min-h-0 flex gap-4 relative items-stretch">
        {/* LEFT PANEL - Clean Glass Card */}
        <CollapsibleSidebar
          width="420px"
          peekWidth="20px"
          collapseBreakpoint={1280}
          side="left"
          isExpanded={isSidebarExpanded}
          onExpandedChange={handleSidebarToggle}
        >
        <div className="h-full bg-white/40 backdrop-blur-xl rounded-[24px] border-2 border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden">
          {/* Compact Header with Search */}
          <div className="p-4">
            {/* Search Bar - Glass Morphism */}
            <Input
              variant="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="text-sm"
            />
          </div>

          {/* Scrollable Note List */}
          <div className="flex-1 overflow-y-auto">
            {displayedNotes.length > 0 ? (
              <div className="space-y-2 p-4">
                {displayedNotes.map((note) => {
                  // Get all related entities
                  const relatedCompanies = entitiesState.companies.filter(c => note.companyIds?.includes(c.id));
                  const relatedContacts = entitiesState.contacts.filter(c => note.contactIds?.includes(c.id));
                  const relatedTopics = entitiesState.topics.filter(t => note.topicIds?.includes(t.id));

                  // Legacy support
                  if (note.topicId) {
                    const legacyCompany = entitiesState.companies.find(c => c.id === note.topicId);
                    const legacyContact = entitiesState.contacts.find(c => c.id === note.topicId);
                    const legacyTopic = entitiesState.topics.find(t => t.id === note.topicId);
                    if (legacyCompany && !relatedCompanies.some(c => c.id === legacyCompany.id)) relatedCompanies.push(legacyCompany);
                    if (legacyContact && !relatedContacts.some(c => c.id === legacyContact.id)) relatedContacts.push(legacyContact);
                    if (legacyTopic && !relatedTopics.some(t => t.id === legacyTopic.id)) relatedTopics.push(legacyTopic);
                  }

                  const sentiment = note.metadata?.sentiment;
                  const noteTasks = tasksState.tasks.filter(t => t.noteId === note.id);
                  const isSelected = note.id === selectedNoteIdForInline;

                  return (
                    <div
                      key={note.id}
                      className={`group relative bg-white/30 backdrop-blur-xl rounded-[24px] p-3 cursor-pointer border-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] will-change-transform ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-100/20 shadow-lg shadow-cyan-100/30'
                          : 'border-white/60 hover:border-cyan-200/60 hover:shadow-md'
                      }`}
                      onClick={(e) => handleNoteClick(note.id, e)}
                      style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                    >
                      {/* Compact header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {/* Show related entities */}
                          {relatedCompanies.length > 0 && (
                            <span className="text-[9px] text-blue-600 truncate">🏢 {relatedCompanies[0].name}</span>
                          )}
                          {relatedContacts.length > 0 && (
                            <span className="text-[9px] text-emerald-600 truncate">👤 {relatedContacts[0].name}</span>
                          )}
                          {relatedTopics.length > 0 && (
                            <span className="text-[9px] text-amber-600 truncate">📌 {relatedTopics[0].name}</span>
                          )}
                          {sentiment && (
                            <span className="text-xs">
                              {sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😞' : '😐'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[9px] text-gray-500">{formatRelativeTime(note.timestamp)}</span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className={`text-sm font-semibold mb-1 line-clamp-2 leading-tight ${
                        isSelected ? 'text-cyan-900' : 'text-gray-900'
                      }`}>
                        {generateNoteTitle(note.summary)}
                      </h3>

                      {/* Content preview */}
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2">
                        {truncateText(note.content, 100)}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between gap-2">
                        {note.tags && note.tags.length > 0 ? (
                          <InlineTagManager
                            tags={note.tags}
                            onTagsChange={() => {}} // Read-only on cards
                            onTagClick={(tag) => toggleTag(tag)}
                            maxDisplayed={3}
                            editable={false}
                            className="flex-1"
                          />
                        ) : (
                          <div className="flex-1" />
                        )}
                        {noteTasks.length > 0 && (
                          <div className="flex items-center gap-1 text-emerald-600 text-[9px] flex-shrink-0">
                            <CheckSquare className="w-3 h-3" />
                            <span>{noteTasks.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="bg-white/40 backdrop-blur-xl rounded-[24px] p-8 border-2 border-white/50">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 mb-1">No notes found</h3>
                  <p className="text-xs text-gray-600">
                    {activeFiltersCount > 0
                      ? 'Try adjusting your filters'
                      : 'Start capturing thoughts in Capture zone'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Note Count - Glass Morphism */}
          <div className="px-4 py-3 border-t-2 border-white/50 bg-white/30 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-medium text-gray-600">
                {displayedNotes.length} {displayedNotes.length === 1 ? 'note' : 'notes'}
                {displayedNotes.length !== notesState.notes.length && (
                  <span className="text-gray-400"> of {notesState.notes.length} total</span>
                )}
              </span>
            </div>
          </div>
        </div>
        </CollapsibleSidebar>

        {/* RIGHT PANEL - Clean Glass Card */}
        <div className="flex-1 min-h-0 bg-white/30 backdrop-blur-2xl rounded-[24px] border-2 border-white/60 shadow-xl flex flex-col overflow-hidden">
          {selectedNoteIdForInline ? (
            <NoteDetailInline
              noteId={selectedNoteIdForInline}
              onToggleSidebar={handleSidebarToggle}
              isSidebarExpanded={isSidebarExpanded}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-center px-12">
              <div className="bg-white/40 backdrop-blur-2xl rounded-[32px] p-12 border-2 border-white/50 max-w-md">
                <div className="text-6xl mb-6">📚</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to your Notes</h2>
                <p className="text-gray-600 mb-6">
                  Select a note from the list to view and edit its details
                </p>
                <div className="text-sm text-gray-500 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-2 py-1 bg-white/60 rounded text-xs font-mono">Click</span>
                    <span>to select a note</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="px-2 py-1 bg-white/60 rounded text-xs font-mono">⌘ + Click</span>
                    <span>to open in modal</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

