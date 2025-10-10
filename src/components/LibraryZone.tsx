import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { sortTopics, filterNotesByTopic, formatRelativeTime, truncateText, generateNoteTitle } from '../utils/helpers';
import { Clock, FileText, Trash2, ChevronRight, Search, X, Grid3x3, List as ListIcon, SlidersHorizontal, CheckSquare } from 'lucide-react';
import { NoteDetailInline } from './NoteDetailInline';

export function LibraryZone() {
  const { state, dispatch } = useApp();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>();
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>();
  const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<('call' | 'email' | 'thought' | 'other')[]>([]);
  const [selectedSentiments, setSelectedSentiments] = useState<('positive' | 'neutral' | 'negative')[]>([]);
  const [sortBy] = useState<'recent' | 'name' | 'noteCount'>('recent');
  const [noteSortBy, setNoteSortBy] = useState<'recent' | 'oldest' | 'alphabetical'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showFilters, setShowFilters] = useState(true);
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [selectedNoteIdForInline, setSelectedNoteIdForInline] = useState<string | undefined>();

  // Listen for activeNoteId changes (for modal opening)
  useEffect(() => {
    if (state.activeNoteId) {
      const note = state.notes.find(n => n.id === state.activeNoteId);
      if (note) {
        dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
        dispatch({ type: 'SET_ACTIVE_NOTE', payload: undefined });
      }
    }
  }, [state.activeNoteId, state.notes, dispatch]);

  const sortedCompanies = useMemo(() => {
    return [...state.companies].sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.noteCount - a.noteCount;
    });
  }, [state.companies, sortBy]);

  const sortedContacts = useMemo(() => {
    return [...state.contacts].sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.noteCount - a.noteCount;
    });
  }, [state.contacts, sortBy]);

  const sortedTopics = useMemo(() => sortTopics(state.topics, sortBy), [state.topics, sortBy]);

  // Extract all unique tags from notes with counts
  const allTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    state.notes.forEach(note => {
      note.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [state.notes]);

  const displayedNotes = useMemo(() => {
    let notes = state.notes;

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
  }, [state.notes, selectedCompanyId, selectedContactId, selectedTopicId, selectedTags, selectedSources, selectedSentiments, searchQuery, noteSortBy]);

  // Auto-select first note when displayedNotes changes
  useEffect(() => {
    if (displayedNotes.length > 0 && !selectedNoteIdForInline) {
      setSelectedNoteIdForInline(displayedNotes[0].id);
    }
  }, [displayedNotes, selectedNoteIdForInline]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm('Delete this note?')) {
      dispatch({ type: 'DELETE_NOTE', payload: noteId });
    }
  };


  const activeFiltersCount = (selectedCompanyId ? 1 : 0) + (selectedContactId ? 1 : 0) + (selectedTopicId ? 1 : 0) + selectedTags.length + selectedSources.length + selectedSentiments.length + (searchQuery ? 1 : 0);

  const handleNoteClick = (noteId: string, e: React.MouseEvent) => {
    // If Cmd/Ctrl is held, open in modal instead
    if (e.metaKey || e.ctrlKey) {
      const note = state.notes.find(n => n.id === noteId);
      if (note) {
        dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
      }
    } else {
      setSelectedNoteIdForInline(noteId);
    }
  };

  return (
    <div className="h-full w-full relative flex flex-col bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-teal-500/20">
      {/* Secondary animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-cyan-500/10 to-teal-500/10 animate-gradient-reverse pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pt-24 px-6 pb-6 overflow-hidden">
        {/* Header - Menu Bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 bg-white/60 backdrop-blur-xl border-2 border-white/50 rounded-xl p-1.5 shadow-lg">
            {/* Sort By Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Sort:</span>
              <select
                value={noteSortBy}
                onChange={(e) => setNoteSortBy(e.target.value as 'recent' | 'oldest' | 'alphabetical')}
                className="px-3 py-1.5 text-sm font-medium bg-white/60 backdrop-blur-sm border-2 border-white/60 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 transition-all hover:bg-white/80"
              >
                <option value="recent">Recent</option>
                <option value="oldest">Oldest</option>
                <option value="alphabetical">A-Z</option>
              </select>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-white/30"></div>

            {/* Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 text-sm font-medium ${
                showFilters
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/80'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 bg-white/30 text-white text-xs font-bold rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/60">
            <span>{state.notes.length} total</span>
            <span className="text-gray-300">•</span>
            <span>{displayedNotes.length} filtered</span>
          </div>
        </div>

        {/* Split-screen Layout */}
        <div className="flex-1 flex overflow-hidden gap-4">
        {/* LEFT PANEL - Clean Glass Card */}
        <div className="w-[420px] flex-shrink-0 bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl flex flex-col overflow-hidden">
          {/* Compact Header with Search */}
          <div className="p-4">
            {/* Search Bar - Glass Morphism */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-white/60 backdrop-blur-sm border-2 border-white/60 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-cyan-300 transition-all shadow-sm hover:bg-white/80"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all hover:scale-110"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Compact Filters with Glass Morphism */}
          {showFilters && (
            <div className="px-6 py-3 space-y-3 bg-white/40 backdrop-blur-xl border-t border-b border-white/50 max-h-64 overflow-y-auto">
              {/* Companies */}
              {sortedCompanies.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🏢</span>
                    <span>Companies</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sortedCompanies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => setSelectedCompanyId(company.id === selectedCompanyId ? undefined : company.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                          selectedCompanyId === company.id
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                            : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white/80 border border-white/60'
                        }`}
                      >
                        {company.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacts */}
              {sortedContacts.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <span>👤</span>
                    <span>Contacts</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sortedContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => setSelectedContactId(contact.id === selectedContactId ? undefined : contact.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                          selectedContactId === contact.id
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                            : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white/80 border border-white/60'
                        }`}
                      >
                        {contact.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics ("Other" category) */}
              {sortedTopics.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold mb-2 uppercase tracking-wide flex items-center gap-1.5">
                    <span>📌</span>
                    <span>Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sortedTopics.map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopicId(topic.id === selectedTopicId ? undefined : topic.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                          selectedTopicId === topic.id
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                            : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white/80 border border-white/60'
                        }`}
                      >
                        {topic.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {allTags.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 font-semibold mb-2 uppercase tracking-wide">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.slice(0, 8).map(({ tag }) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                          selectedTags.includes(tag)
                            ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md'
                            : 'bg-white/60 backdrop-blur-sm text-gray-700 hover:bg-white/80 border border-white/60'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => {
                    setSelectedCompanyId(undefined);
                    setSelectedContactId(undefined);
                    setSelectedTopicId(undefined);
                    setSelectedTags([]);
                    setSelectedSources([]);
                    setSelectedSentiments([]);
                  }}
                  className="text-red-600 hover:text-red-700 text-[10px] font-semibold transition-all hover:scale-105 active:scale-95"
                >
                  × Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Scrollable Note List */}
          <div className="flex-1 overflow-y-auto">
            {displayedNotes.length > 0 ? (
              <div className="space-y-2 p-4">
                {displayedNotes.map((note) => {
                  // Get all related entities
                  const relatedCompanies = state.companies.filter(c => note.companyIds?.includes(c.id));
                  const relatedContacts = state.contacts.filter(c => note.contactIds?.includes(c.id));
                  const relatedTopics = state.topics.filter(t => note.topicIds?.includes(t.id));

                  // Legacy support
                  if (note.topicId) {
                    const legacyCompany = state.companies.find(c => c.id === note.topicId);
                    const legacyContact = state.contacts.find(c => c.id === note.topicId);
                    const legacyTopic = state.topics.find(t => t.id === note.topicId);
                    if (legacyCompany && !relatedCompanies.some(c => c.id === legacyCompany.id)) relatedCompanies.push(legacyCompany);
                    if (legacyContact && !relatedContacts.some(c => c.id === legacyContact.id)) relatedContacts.push(legacyContact);
                    if (legacyTopic && !relatedTopics.some(t => t.id === legacyTopic.id)) relatedTopics.push(legacyTopic);
                  }

                  const sentiment = note.metadata?.sentiment;
                  const noteTasks = state.tasks.filter(t => t.noteId === note.id);
                  const isSelected = note.id === selectedNoteIdForInline;

                  return (
                    <div
                      key={note.id}
                      className={`group relative bg-white/50 backdrop-blur-xl rounded-xl p-3 cursor-pointer border-2 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${
                        isSelected
                          ? 'border-cyan-400 bg-cyan-50/50 shadow-lg shadow-cyan-100/30'
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
                      <div className="flex items-center justify-between text-[9px]">
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex gap-1">
                            {note.tags.slice(0, 2).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-violet-100/60 text-violet-700 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                            {note.tags.length > 2 && (
                              <span className="text-gray-400">+{note.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                        {noteTasks.length > 0 && (
                          <div className="flex items-center gap-1 text-emerald-600">
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
                <div className="bg-white/40 backdrop-blur-xl rounded-2xl p-8 border-2 border-white/50">
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
                {displayedNotes.length !== state.notes.length && (
                  <span className="text-gray-400"> of {state.notes.length} total</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - Clean Glass Card */}
        <div className="flex-1 bg-white/70 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl flex flex-col overflow-hidden">
          {selectedNoteIdForInline ? (
            <NoteDetailInline noteId={selectedNoteIdForInline} />
          ) : (
            <div className="flex items-center justify-center h-full text-center px-12">
              <div className="bg-white/40 backdrop-blur-2xl rounded-3xl p-12 border-2 border-white/50 max-w-md">
                <div className="text-6xl mb-6">📚</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to your Library</h2>
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

