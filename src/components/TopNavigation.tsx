import { useApp } from '../context/AppContext';
import { Edit3, CheckSquare, BookOpen, Sparkles, User, Search, Command, Plus, Calendar, X, Send, Save, Settings } from 'lucide-react';
import type { TabType, Task } from '../types';
import { ProcessingIndicator } from './ProcessingIndicator';
import { useState, useRef, useEffect } from 'react';
import { generateId } from '../utils/helpers';

interface TabConfig {
  id: TabType;
  label: string;
  icon: typeof Edit3;
  shortcut: string;
}

const tabs: TabConfig[] = [
  { id: 'capture', label: 'Capture', icon: Edit3, shortcut: '⌘1' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, shortcut: '⌘2' },
  { id: 'library', label: 'Library', icon: BookOpen, shortcut: '⌘3' },
  { id: 'assistant', label: 'Ask AI', icon: Sparkles, shortcut: '⌘4' },
];

type IslandState = 'collapsed' | 'task-expanded' | 'note-expanded' | 'search-expanded';

export function TopNavigation() {
  const { state, dispatch } = useApp();
  const activeTab = state.ui.activeTab;
  const [hoveredTab, setHoveredTab] = useState<TabType | null>(null);
  const [islandState, setIslandState] = useState<IslandState>('collapsed');
  const islandRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleTabClick = (tabId: TabType) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId });
  };

  const handleQuickAction = (tabId: TabType, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (tabId === 'tasks') {
      setIslandState(islandState === 'task-expanded' ? 'collapsed' : 'task-expanded');
    } else if (tabId === 'library') {
      setIslandState(islandState === 'note-expanded' ? 'collapsed' : 'note-expanded');
    }
  };

  const closeIsland = () => {
    setIslandState('collapsed');
    setTaskTitle('');
    setTaskDueDate('');
    setNoteInput('');
    setSearchQuery('');
    setShowTaskSuccess(false);
  };

  const handleProfileClick = () => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' });
  };

  const handleSearchClick = () => {
    if (islandState === 'search-expanded') {
      closeIsland();
    } else {
      setIslandState('search-expanded');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const activeTasks = state.tasks.filter(t => !t.done).length;

  // Listen for CMD+K command palette toggle and open search instead
  useEffect(() => {
    if (state.ui.showCommandPalette) {
      setIslandState('search-expanded');
      // Close the command palette flag
      dispatch({ type: 'TOGGLE_COMMAND_PALETTE' });

      // Focus search input after a small delay to ensure it's rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [state.ui.showCommandPalette, dispatch]);

  // Quick Task Dropdown State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [showTaskSuccess, setShowTaskSuccess] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  // Quick Note Dropdown State
  const [noteInput, setNoteInput] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateQuickTask = () => {
    if (!taskTitle.trim()) return;

    const newTask: Task = {
      id: generateId(),
      title: taskTitle,
      done: false,
      priority: 'medium',
      status: 'todo',
      createdBy: 'manual',
      createdAt: new Date().toISOString(),
      dueDate: taskDueDate || undefined,
    };

    dispatch({ type: 'ADD_TASK', payload: newTask });
    setCreatedTaskId(newTask.id);
    setShowTaskSuccess(true);
    setTaskTitle('');
    setTaskDueDate('');

    // Auto-hide success after 2s
    setTimeout(() => {
      closeIsland();
    }, 2000);
  };

  const handleViewTask = () => {
    if (createdTaskId) {
      dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: createdTaskId, label: 'Task Details' } });
      dispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
      closeIsland();
    }
  };

  const handleSaveQuickNote = async () => {
    if (!noteInput.trim()) return;

    dispatch({
      type: 'CREATE_MANUAL_NOTE',
      payload: {
        content: noteInput,
        source: 'thought',
        processWithAI: false,
      }
    });

    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        title: 'Quick Note Saved',
        message: 'Your note has been saved to the library',
      }
    });

    closeIsland();
  };

  const handleSendToAI = async () => {
    if (!noteInput.trim()) return;

    dispatch({
      type: 'ADD_PROCESSING_JOB',
      payload: {
        type: 'note',
        input: noteInput,
        status: 'queued',
        progress: 0,
      }
    });

    closeIsland();
    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
  };

  const isExpanded = islandState !== 'collapsed';

  return (
    <>
    {/* Blur overlay when island is expanded */}
    {isExpanded && (
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-500 ease-out"
        style={{ opacity: isExpanded ? 1 : 0 }}
        onClick={closeIsland}
      />
    )}

    {/* Fixed Logo - Left */}
    <div className="fixed top-0 left-0 z-50 pt-4 px-6 pointer-events-none">
      <div className="flex items-center gap-2 px-3 py-3 bg-white/60 backdrop-blur-2xl rounded-3xl shadow-xl border-2 border-white/50 ring-1 ring-black/5 pointer-events-auto transition-all duration-300 hover:shadow-2xl hover:scale-105" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-xs">T</span>
        </div>
        <span className="font-bold text-lg bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
          Taskerino
        </span>
      </div>
    </div>

    {/* Fixed Profile - Right */}
    <div className="fixed top-0 right-0 z-50 pt-4 px-6 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Processing Indicator */}
        <ProcessingIndicator />

        {/* Reference Panel Toggle */}
        {state.ui.pinnedNotes.length > 0 && (
          <button
            onClick={() => dispatch({ type: 'TOGGLE_REFERENCE_PANEL' })}
            className={`px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-300 shadow-xl border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5 hover:scale-105 ${
              state.ui.referencePanelOpen
                ? 'bg-white/90 text-cyan-600 shadow-cyan-200/40'
                : 'bg-white/60 text-gray-600 hover:bg-white/80 hover:shadow-2xl'
            }`}
            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            title="Toggle reference panel"
          >
            📌 {state.ui.pinnedNotes.length}
          </button>
        )}

        {/* Profile Button */}
        <button
          onClick={handleProfileClick}
          className={`p-3 rounded-3xl transition-all duration-300 shadow-xl border-2 border-white/50 backdrop-blur-2xl ring-1 ring-black/5 hover:scale-105 ${
            activeTab === 'profile'
              ? 'bg-white/90 text-cyan-600 shadow-cyan-200/40'
              : 'bg-white/60 text-gray-600 hover:bg-white/80 hover:shadow-2xl'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          title="Profile & Settings (⌘,)"
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </div>

    {/* Dynamic Island - Center */}
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-6 pointer-events-none">
      <div
        ref={islandRef}
        className={`
          bg-white/60 backdrop-blur-2xl rounded-3xl shadow-2xl border-2 border-white/50 ring-1 ring-black/5
          pointer-events-auto overflow-hidden
          ${isExpanded ? 'w-full max-w-2xl' : 'w-auto'}
        `}
        style={{
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: isExpanded ? 'width, height' : 'auto',
        }}
      >
        {/* Navigation Tabs */}
        <div className={`flex items-center justify-center gap-2 px-4 py-3 transition-all duration-500 ${islandState === 'search-expanded' ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = tab.id === 'tasks' ? activeTasks : 0;
              const hasQuickAction = tab.id === 'tasks' || tab.id === 'library';
              const isHovered = hoveredTab === tab.id;

              return (
                <div
                  key={tab.id}
                  className="relative group"
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                >
                  <button
                    onClick={() => handleTabClick(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 hover:scale-105 active:scale-95 ${
                      isActive
                        ? 'bg-white/90 backdrop-blur-lg shadow-lg text-cyan-600 border border-white/60'
                        : 'bg-white/50 backdrop-blur-md text-gray-600 hover:text-gray-900 hover:bg-white/80 hover:shadow-md border border-transparent hover:border-white/40'
                    } ${hasQuickAction && (isActive || isHovered) ? 'pr-10' : ''}`}
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                    title={`${tab.label} (${tab.shortcut})`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {badge > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-bold rounded-full min-w-[20px] text-center">
                        {badge}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                    )}
                  </button>

                  {/* Quick Action Button */}
                  {hasQuickAction && (
                    <button
                      onClick={(e) => handleQuickAction(tab.id, e)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-xl transition-all duration-300 hover:scale-110 ${
                        (isActive || isHovered) ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                      }`}
                      style={{
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                      title={`Quick add ${tab.id === 'tasks' ? 'task' : 'note'}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Search Button */}
            <div className="h-8 w-px bg-white/30 mx-2"></div>
            <button
              onClick={handleSearchClick}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 hover:text-gray-900 bg-white/50 backdrop-blur-md hover:bg-white/80 hover:shadow-md transition-all duration-300 hover:scale-105 active:scale-95 border border-transparent hover:border-white/40"
              style={{
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" />
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">⌘K</kbd>
            </button>
        </div>

        {/* Search Mode - Spotlight-style integrated search */}
        {islandState === 'search-expanded' && (
          <div
            style={{
              animation: 'fadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-white/30 bg-white/20">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeIsland();
                }}
                placeholder="Search anything or run a command..."
                className="flex-1 bg-transparent border-0 focus:outline-none text-base placeholder-gray-400 text-gray-900"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-white/60 rounded-lg transition-all duration-200"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {(() => {
                const query = searchQuery.toLowerCase();
                const taskResults = state.tasks.filter(task =>
                  task.title.toLowerCase().includes(query)
                ).slice(0, 5);
                const noteResults = state.notes.filter(note =>
                  note.content.toLowerCase().includes(query) ||
                  note.summary.toLowerCase().includes(query) ||
                  note.tags.some(tag => tag.toLowerCase().includes(query))
                ).slice(0, 5);
                const topicResults = state.topics.filter(topic =>
                  topic.name.toLowerCase().includes(query)
                ).slice(0, 3);

                const hasResults = taskResults.length > 0 || noteResults.length > 0 || topicResults.length > 0;
                const showActions = !searchQuery || !hasResults;

                return (
                  <div className="p-2">
                    {/* Quick Actions - Always show when no search or no results */}
                    {showActions && (
                      <div className="mb-2">
                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Actions</div>
                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <Edit3 className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Go to Capture</div>
                              <div className="text-xs text-gray-500">Create and process notes</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘1</kbd>
                          </button>

                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <CheckSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Go to Tasks</div>
                              <div className="text-xs text-gray-500">Manage your tasks</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘2</kbd>
                          </button>

                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_ACTIVE_TAB', payload: 'library' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Go to Library</div>
                              <div className="text-xs text-gray-500">Browse all notes</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘3</kbd>
                          </button>

                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_ACTIVE_TAB', payload: 'assistant' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">Ask AI Assistant</div>
                              <div className="text-xs text-gray-500">Get help with your notes</div>
                            </div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘4</kbd>
                          </button>

                          <div className="h-px bg-white/30 my-2" />

                          <button
                            onClick={() => {
                              setIslandState('task-expanded');
                              setSearchQuery('');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <Plus className="w-4 h-4 text-cyan-600" />
                            <div className="text-sm font-medium text-gray-900">Create New Task</div>
                          </button>

                          <button
                            onClick={() => {
                              setIslandState('note-expanded');
                              setSearchQuery('');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <Plus className="w-4 h-4 text-purple-600" />
                            <div className="text-sm font-medium text-gray-900">Create New Note</div>
                          </button>

                          <button
                            onClick={() => {
                              dispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' });
                              closeIsland();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left group"
                          >
                            <Settings className="w-4 h-4 text-gray-600" />
                            <div className="text-sm font-medium text-gray-900">Settings</div>
                            <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘,</kbd>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Search Results */}
                    {searchQuery && hasResults && (
                      <>
                        {/* Tasks */}
                        {taskResults.length > 0 && (
                          <div className="mb-2">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</div>
                            <div className="space-y-1">
                              {taskResults.map(task => (
                                <button
                                  key={task.id}
                                  onClick={() => {
                                    dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: task.id, label: task.title } });
                                    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
                                    closeIsland();
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left"
                                >
                                  <CheckSquare className={`w-4 h-4 ${task.done ? 'text-green-600' : 'text-cyan-600'}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium truncate ${task.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                      {task.title}
                                    </div>
                                    {(task.dueDate || task.priority !== 'medium') && (
                                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                        {task.priority !== 'medium' && (
                                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                            task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                            task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                            'bg-blue-100 text-blue-700'
                                          }`}>
                                            {task.priority}
                                          </span>
                                        )}
                                        {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString()}</span>}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {noteResults.length > 0 && (
                          <div className="mb-2">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</div>
                            <div className="space-y-1">
                              {noteResults.map(note => (
                                <button
                                  key={note.id}
                                  onClick={() => {
                                    dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
                                    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'library' });
                                    closeIsland();
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left"
                                >
                                  <BookOpen className="w-4 h-4 text-purple-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{note.summary}</div>
                                    {note.tags.length > 0 && (
                                      <div className="flex gap-1 mt-0.5">
                                        {note.tags.slice(0, 2).map(tag => (
                                          <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Topics */}
                        {topicResults.length > 0 && (
                          <div className="mb-2">
                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Topics</div>
                            <div className="space-y-1">
                              {topicResults.map(topic => (
                                <button
                                  key={topic.id}
                                  onClick={() => {
                                    dispatch({ type: 'SET_ACTIVE_TAB', payload: 'library' });
                                    closeIsland();
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 rounded-xl transition-all text-left"
                                >
                                  <Command className="w-4 h-4 text-cyan-600" />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                                    <div className="text-xs text-gray-500">{topic.noteCount} notes</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* No results */}
                    {searchQuery && !hasResults && (
                      <div className="text-center py-8">
                        <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-900 mb-1">No results found</p>
                        <p className="text-xs text-gray-500">Try a different search term</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-white/30 px-4 py-2 bg-white/20 flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white/60 border border-white/60 rounded text-xs">↵</kbd>
                  <span>Select</span>
                </div>
              </div>
              <div>
                Press <kbd className="px-1.5 py-0.5 bg-white/60 border border-white/60 rounded">⌘K</kbd> to open
              </div>
            </div>
          </div>
        )}

        {/* Expanded Content Area - Tasks */}
        {islandState === 'task-expanded' && (
          <div
            className="px-6 pb-5 pt-4 border-t-2 border-white/30"
            style={{
              animation: 'fadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
          >
            {!showTaskSuccess ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && taskTitle.trim()) handleCreateQuickTask();
                    if (e.key === 'Escape') closeIsland();
                  }}
                  placeholder="What needs to be done?"
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-white/50 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white/80 transition-all placeholder-gray-400"
                  autoFocus
                />

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500 ml-1" />
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/60 backdrop-blur-sm border-2 border-white/50 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus:bg-white/80 transition-all text-sm"
                  />
                </div>

                {taskTitle.trim() && (
                  <button
                    onClick={handleCreateQuickTask}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600"
                  >
                    Create Task
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Task Created</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleViewTask}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
                  >
                    View
                  </button>
                  <button
                    onClick={closeIsland}
                    className="flex-1 px-3 py-2 bg-white/60 hover:bg-white/80 text-gray-700 rounded-xl text-sm font-semibold transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {islandState === 'note-expanded' && (
          <div
            className="border-t-2 border-white/30"
            style={{
              animation: 'fadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
          >
            <div className="px-2 pt-2">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeIsland();
                }}
                placeholder="Capture your thoughts..."
                className="w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-0 text-base min-h-[100px] resize-none placeholder-gray-400"
                autoFocus
              />
            </div>

            {noteInput.trim() && (
              <div className="px-4 pb-4 pt-2 flex gap-2">
                <button
                  onClick={handleSaveQuickNote}
                  className="flex items-center gap-2 px-4 py-2 bg-white/60 hover:bg-white/80 backdrop-blur-sm rounded-xl transition-all text-sm font-semibold text-gray-700 hover:text-cyan-600"
                >
                  <Save className="w-4 h-4" />
                  Save Note
                </button>
                <button
                  onClick={handleSendToAI}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-2xl font-bold hover:shadow-xl transform hover:scale-105 transition-all duration-200 hover:from-violet-600 hover:to-fuchsia-600"
                >
                  Process & File
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>

    </>
  );
}
