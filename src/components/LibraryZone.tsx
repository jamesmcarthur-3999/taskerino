import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';
import { useTasks } from '../context/TasksContext';
import { useUI } from '../context/UIContext';
import { useScrollAnimation } from '../contexts/ScrollAnimationContext';
import { clamp, easeOutQuart } from '../utils/easing';
import { sortTopics, formatRelativeTime, truncateText, generateNoteTitle, generateId } from '../utils/helpers';
import { Clock, FileText, Search, X, SlidersHorizontal, CheckSquare, Plus, TrendingDown, TrendingUp, SortAsc, CheckCheck } from 'lucide-react';
import { GlassSelect } from './GlassSelect';
import { NoteDetailInline } from './NoteDetailInline';
import { Input } from './Input';
import { SpaceMenuBar } from './SpaceMenuBar';
import { motion } from 'framer-motion';
import { StandardFilterPanel } from './StandardFilterPanel';
import { InlineTagManager } from './InlineTagManager';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import { NoteBulkOperationsBar } from './notes/NoteBulkOperationsBar';
import type { Note } from '../types';
import { BACKGROUND_GRADIENT, getGlassClasses, getNoteCardClasses, PANEL_FOOTER } from '../design-system/theme';

export default function LibraryZone() {
  const { state: notesState, dispatch: notesDispatch } = useNotes();
  const { state: entitiesState } = useEntities();
  const { state: tasksState } = useTasks();
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { registerScrollContainer, unregisterScrollContainer, scrollY } = useScrollAnimation();
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<('call' | 'email' | 'thought' | 'other')[]>([]);
  const [selectedSentiments, setSelectedSentiments] = useState<('positive' | 'neutral' | 'negative')[]>([]);
  const [sortBy] = useState<'recent' | 'name' | 'noteCount'>('recent');
  const [noteSortBy, setNoteSortBy] = useState<'recent' | 'oldest' | 'alphabetical'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNoteIdForInline, setSelectedNoteIdForInline] = useState<string | undefined>();

  // Bulk selection state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // Ref for scrollable notes list container
  const notesListScrollRef = useRef<HTMLDivElement>(null);

  // Ref for content container (enables scroll-driven expansion)
  const contentRef = useRef<HTMLDivElement>(null);

  // Ref for main container to apply dynamic top padding
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Ref for stats pill scroll animations
  const statsPillRef = useRef<HTMLDivElement>(null);

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

  // Register scroll container with ScrollAnimationContext
  useEffect(() => {
    const container = notesListScrollRef.current;
    if (container) {
      registerScrollContainer(container);
      return () => unregisterScrollContainer(container);
    }
  }, [registerScrollContainer, unregisterScrollContainer]);

  /**
   * Scroll-driven content expansion
   * DELAYED until after header collapse (150px) to prevent premature upward expansion
   */
  useEffect(() => {
    if (!mainContainerRef.current) return;

    const container = mainContainerRef.current;

    // Initial padding is 110px (enough to clear navigation island)
    const initialPadding = 110;
    const minPadding = 20;

    // DELAY: Only start reducing padding AFTER header collapse completes (at 150px)
    const delayThreshold = 150;
    const scrollRange = 150; // Padding reduction happens over 150-300px range

    if (scrollY < delayThreshold) {
      // Header hasn't collapsed yet - keep initial padding
      container.style.paddingTop = `${initialPadding}px`;
    } else {
      // Header has collapsed - now reduce padding from 120 to 20px over next 150px
      const delayedScrollY = scrollY - delayThreshold;
      const paddingReduction = Math.min(delayedScrollY, scrollRange) / scrollRange * (initialPadding - minPadding);
      const newPadding = initialPadding - paddingReduction;
      container.style.paddingTop = `${newPadding}px`;
    }
  }, [scrollY]);

  /**
   * Stats pill scroll animation (independent fade)
   * Fades out the stats pill as user scrolls
   */
  useEffect(() => {
    const applyStatsTransform = () => {
      if (statsPillRef.current && scrollY > 0) {
        const progress = Math.min((scrollY - 50) / 250, 1);
        const opacity = 1 - progress;
        const scale = 1 - (progress * 0.03);
        const blur = progress * 3;

        statsPillRef.current.style.opacity = String(opacity);
        statsPillRef.current.style.transform = `scale(${scale})`;
        statsPillRef.current.style.filter = `blur(${blur}px)`;
      } else if (statsPillRef.current && scrollY === 0) {
        // Reset when scrolled to top
        statsPillRef.current.style.opacity = '1';
        statsPillRef.current.style.transform = 'scale(1)';
        statsPillRef.current.style.filter = 'blur(0px)';
      }
    };

    applyStatsTransform();
  }, [scrollY]);

  /**
   * Auto-close filter panel when menu morphs to compact state
   * Prevents filter panel positioning issues during scroll
   */
  useEffect(() => {
    if (scrollY >= 100 && showFilters) {
      setShowFilters(false);
    }
  }, [scrollY, showFilters]);

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

    // Filter by companies (multi-select)
    if (selectedCompanyIds.length > 0) {
      notes = notes.filter(note =>
        note.companyIds?.some(id => selectedCompanyIds.includes(id)) ||
        (note.topicId && selectedCompanyIds.includes(note.topicId)) // Legacy support
      );
    }

    // Filter by contacts (multi-select)
    if (selectedContactIds.length > 0) {
      notes = notes.filter(note =>
        note.contactIds?.some(id => selectedContactIds.includes(id)) ||
        (note.topicId && selectedContactIds.includes(note.topicId)) // Legacy support
      );
    }

    // Filter by topics (multi-select)
    if (selectedTopicIds.length > 0) {
      notes = notes.filter(note =>
        note.topicIds?.some(id => selectedTopicIds.includes(id)) ||
        (note.topicId && selectedTopicIds.includes(note.topicId)) // Legacy support
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
  }, [notesState.notes, selectedCompanyIds, selectedContactIds, selectedTopicIds, selectedTags, selectedSources, selectedSentiments, searchQuery, noteSortBy]);

  // Auto-select first note when displayedNotes changes
  useEffect(() => {
    if (displayedNotes.length > 0 && !selectedNoteIdForInline) {
      setSelectedNoteIdForInline(displayedNotes[0].id);
    }
  }, [displayedNotes, selectedNoteIdForInline]);

  const toggleCompany = useCallback((companyId: string) => {
    setSelectedCompanyIds(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  }, []);

  const toggleContact = useCallback((contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  }, []);

  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  const activeFiltersCount = selectedCompanyIds.length + selectedContactIds.length + selectedTopicIds.length + selectedTags.length + selectedSources.length + selectedSentiments.length + (searchQuery ? 1 : 0);

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
    <div className={`h-full w-full relative flex flex-col ${BACKGROUND_GRADIENT.primary}`}>
      {/* Secondary animated gradient overlay */}
      <div className={`absolute inset-0 ${BACKGROUND_GRADIENT.secondary} pointer-events-none will-change-transform`} />

      <div ref={mainContainerRef} className="relative z-10 flex-1 min-h-0 flex flex-col px-6 pb-6" style={{ paddingTop: '110px' }}>
        {/* Header with Stats Pill - Side by Side Layout */}
        <motion.div
          className="flex items-center justify-between gap-4 mb-4"
          animate={{ opacity: scrollY < 100 ? 1 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="bg-white/40 backdrop-blur-2xl rounded-[9999px] border-2 border-white/50 shadow-xl px-4 py-2">
            <SpaceMenuBar
                primaryAction={{
                  label: 'New Note',
                  icon: <Plus size={16} />,
                  onClick: handleCreateNewNote,
                  gradient: 'purple',
                }}
                glassDropdowns={
                  <GlassSelect
                    value={noteSortBy}
                    onChange={(value) => setNoteSortBy(value as typeof noteSortBy)}
                    options={[
                      { value: 'recent', label: 'Recent First', icon: TrendingDown },
                      { value: 'oldest', label: 'Oldest First', icon: TrendingUp },
                      { value: 'alphabetical', label: 'A-Z', icon: SortAsc },
                    ]}
                    variant="primary"
                    triggerIcon={SortAsc}
                    placeholder="Sort by..."
                  />
                }
                filters={{
                  active: showFilters,
                  count: [
                    selectedCompanyIds.length,
                    selectedContactIds.length,
                    selectedTopicIds.length,
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
                          selectedIds: selectedCompanyIds,
                          onToggle: toggleCompany,
                          multiSelect: true,
                        },
                        {
                          title: 'CONTACTS',
                          items: sortedContacts.map(c => ({ id: c.id, label: c.name })),
                          selectedIds: selectedContactIds,
                          onToggle: toggleContact,
                          multiSelect: true,
                        },
                        {
                          title: 'TOPICS',
                          items: sortedTopics.map(t => ({ id: t.id, label: t.name })),
                          selectedIds: selectedTopicIds,
                          onToggle: toggleTopic,
                          multiSelect: true,
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
                        setSelectedCompanyIds([]);
                        setSelectedContactIds([]);
                        setSelectedTopicIds([]);
                        setSelectedTags([]);
                        setSelectedSources([]);
                        setSelectedSentiments([]);
                      }}
                    />
                  ) : undefined,
                }}
                stats={undefined}
                className=""
              >
                {/* Select Button */}
                <motion.button
                  layout
                  onClick={() => {
                    setBulkSelectMode(!bulkSelectMode);
                    if (bulkSelectMode) {
                      setSelectedNoteIds(new Set());
                    }
                  }}
                  className={`backdrop-blur-sm border-2 rounded-full text-sm font-semibold transition-all flex items-center ${
                    bulkSelectMode
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md border-transparent'
                      : 'bg-white/50 border-white/60 text-gray-700 hover:bg-white/70 hover:border-purple-300'
                  } focus:ring-2 focus:ring-purple-400 focus:border-purple-300 outline-none`}
                  style={{
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                  }}
                  transition={{
                    layout: {
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }
                  }}
                  title="Select multiple notes"
                >
                  <CheckCheck size={16} />
                  <span className="ml-2">Select</span>
                </motion.button>
              </SpaceMenuBar>
          </div>

          {/* Stats pill - side-by-side with menu */}
          <div
            ref={statsPillRef}
            className="flex items-center gap-2 text-sm text-gray-700 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-[9999px] border border-white/60"
          >
            <span>{notesState.notes.length} total</span>
            {displayedNotes.length !== notesState.notes.length && (
              <>
                <span className="text-gray-300">•</span>
                <span>{displayedNotes.length} shown</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Dropdown Menu - Shows when MenuButton is toggled while scrolled */}
        {scrollY >= 100 && uiState.zoneMenuPinned && (
          <motion.div
            className="fixed top-20 left-24 z-50 bg-white/40 backdrop-blur-2xl rounded-[40px] border-2 border-white/50 shadow-2xl ring-1 ring-black/5 px-6 py-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <SpaceMenuBar
                primaryAction={{
                  label: 'New Note',
                  icon: <Plus size={16} />,
                  onClick: handleCreateNewNote,
                  gradient: 'purple',
                }}
                glassDropdowns={
                  <GlassSelect
                    value={noteSortBy}
                    onChange={(value) => setNoteSortBy(value as typeof noteSortBy)}
                    options={[
                      { value: 'recent', label: 'Recent First', icon: TrendingDown },
                      { value: 'oldest', label: 'Oldest First', icon: TrendingUp },
                      { value: 'alphabetical', label: 'A-Z', icon: SortAsc },
                    ]}
                    variant="primary"
                    triggerIcon={SortAsc}
                    placeholder="Sort by..."
                  />
                }
                filters={{
                  active: showFilters,
                  count: [
                    selectedCompanyIds.length,
                    selectedContactIds.length,
                    selectedTopicIds.length,
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
                          selectedIds: selectedCompanyIds,
                          onToggle: (id) => setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]),
                          multiSelect: false,
                        },
                        {
                          title: 'CONTACTS',
                          items: sortedContacts.map(c => ({ id: c.id, label: c.name })),
                          selectedIds: selectedContactIds,
                          onToggle: (id) => setSelectedContactIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]),
                          multiSelect: false,
                        },
                        {
                          title: 'TOPICS',
                          items: sortedTopics.map(t => ({ id: t.id, label: t.name })),
                          selectedIds: selectedTopicIds,
                          onToggle: (id) => setSelectedTopicIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]),
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
                    />
                  ) : undefined,
                }}
                stats={undefined}
                className=""
              >
                {/* Select Button */}
                <motion.button
                  layout
                  onClick={() => {
                    setBulkSelectMode(!bulkSelectMode);
                    if (bulkSelectMode) {
                      setSelectedNoteIds(new Set());
                    }
                  }}
                  className={`backdrop-blur-sm border-2 rounded-full text-sm font-semibold transition-all flex items-center ${
                    bulkSelectMode
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md border-transparent'
                      : 'bg-white/50 border-white/60 text-gray-700 hover:bg-white/70 hover:border-purple-300'
                  } focus:ring-2 focus:ring-purple-400 focus:border-purple-300 outline-none`}
                  style={{
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                  }}
                  transition={{
                    layout: {
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }
                  }}
                  title="Select multiple notes"
                >
                  <CheckCheck size={16} />
                  <span className="ml-2">Select</span>
                </motion.button>
              </SpaceMenuBar>
          </motion.div>
        )}

        {/* Split-screen Layout */}
        <div ref={contentRef} className="flex-1 min-h-0 flex gap-4 relative items-stretch">
        {/* LEFT PANEL - Clean Glass Card */}
        <CollapsibleSidebar
          width="420px"
          peekWidth="20px"
          collapseBreakpoint={1280}
          side="left"
          isExpanded={isSidebarExpanded}
          onExpandedChange={handleSidebarToggle}
        >
        <div className={`h-full ${getGlassClasses('medium')} rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col overflow-hidden`}>
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

          {/* Bulk Operations Bar */}
          {bulkSelectMode && selectedNoteIds.size > 0 && (
            <div className="px-4">
              <NoteBulkOperationsBar
                selectedCount={selectedNoteIds.size}
                totalFilteredCount={displayedNotes.length}
                onSelectAll={() => {
                  const newSet = new Set<string>();
                  displayedNotes.forEach(n => newSet.add(n.id));
                  setSelectedNoteIds(newSet);
                }}
                onDelete={() => {
                  if (window.confirm(`Delete ${selectedNoteIds.size} note${selectedNoteIds.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
                    selectedNoteIds.forEach(id => {
                      notesDispatch({ type: 'DELETE_NOTE', payload: id });
                    });
                    setSelectedNoteIds(new Set());
                    setBulkSelectMode(false);
                  }
                }}
                onAddToTopic={() => {
                  // TODO: Implement topic selector modal
                  alert('Topic selector coming soon!');
                }}
                onAddTags={() => {
                  // TODO: Implement tag selector modal
                  alert('Tag selector coming soon!');
                }}
                onArchive={() => {
                  // TODO: Implement archive functionality
                  alert('Archive functionality coming soon!');
                }}
              />
            </div>
          )}

          {/* Scrollable Note List */}
          <div ref={notesListScrollRef} className="flex-1 overflow-y-auto">
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
                  const isChecked = selectedNoteIds.has(note.id);

                  return (
                    <div
                      key={note.id}
                      className={`${getNoteCardClasses(isSelected)} ${isChecked ? 'ring-2 ring-purple-500 bg-purple-50/20' : ''}`}
                      onClick={(e) => {
                        if (bulkSelectMode) {
                          const newSet = new Set(selectedNoteIds);
                          if (newSet.has(note.id)) {
                            newSet.delete(note.id);
                          } else {
                            newSet.add(note.id);
                          }
                          setSelectedNoteIds(newSet);
                        } else {
                          handleNoteClick(note.id, e);
                        }
                      }}
                      style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                    >
                      {bulkSelectMode && (
                        <div className="absolute top-2 left-2 z-10">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newSet = new Set(selectedNoteIds);
                              if (newSet.has(note.id)) {
                                newSet.delete(note.id);
                              } else {
                                newSet.add(note.id);
                              }
                              setSelectedNoteIds(newSet);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
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
                <div className={`${getGlassClasses('medium')} rounded-[24px] p-8`}>
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
          <div className={PANEL_FOOTER}>
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
        <div className={`flex-1 min-h-0 ${getGlassClasses('strong')} rounded-[24px] flex flex-col overflow-hidden`}>
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

