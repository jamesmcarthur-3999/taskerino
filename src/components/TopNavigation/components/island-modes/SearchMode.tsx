/**
 * SearchMode Component
 *
 * Search/command palette mode for the navigation island
 * Spotlight-style integrated search with quick actions
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - React.memo to prevent re-renders when props haven't changed
 * - useMemo for expensive filter operations
 * - useCallback for handler functions to maintain referential equality
 */

import { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Edit3, CheckSquare, BookOpen, Activity, Sparkles, Settings, Plus, Command } from 'lucide-react';
import type { SearchModeProps } from '../../types';
import { useTasks } from '../../../../context/TasksContext';
import { useNotes } from '../../../../context/NotesContext';
import { useEntities } from '../../../../context/EntitiesContext';
import type { TabType } from '../../../../types';
import { NAVIGATION, getRadiusClass } from '../../../../design-system/theme';
import { modeContentVariants, contentSpring } from '../../utils/islandAnimations';
import { useReducedMotion } from '../../../../lib/animations';

/**
 * Stagger animation variants for search results
 */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function SearchModeComponent(props: SearchModeProps) {
  const {
    searchQuery,
    searchInputRef,
    onSearchQueryChange,
    onNavigate,
    onOpenSidebar,
    onClose,
  } = props;

  const [isFocused, setIsFocused] = useState(true);
  const { state: tasksState } = useTasks();
  const { state: notesState } = useNotes();
  const { state: entitiesState } = useEntities();
  const prefersReducedMotion = useReducedMotion();

  /**
   * PERFORMANCE OPTIMIZATION:
   * Memoize expensive filter operations to prevent re-computation on every render.
   * These filters run through potentially large arrays and perform string operations.
   */
  const query = useMemo(() => searchQuery.toLowerCase(), [searchQuery]);

  const taskResults = useMemo(() => {
    if (!query) return [];
    return tasksState.tasks
      .filter(task => task.title.toLowerCase().includes(query))
      .slice(0, 5);
  }, [query, tasksState.tasks]);

  const noteResults = useMemo(() => {
    if (!query) return [];
    return notesState.notes
      .filter(note =>
        note.content.toLowerCase().includes(query) ||
        note.summary.toLowerCase().includes(query) ||
        note.tags.some(tag => tag.toLowerCase().includes(query))
      )
      .slice(0, 5);
  }, [query, notesState.notes]);

  const topicResults = useMemo(() => {
    if (!query) return [];
    return entitiesState.topics
      .filter(topic => topic.name.toLowerCase().includes(query))
      .slice(0, 3);
  }, [query, entitiesState.topics]);

  const hasResults = taskResults.length > 0 || noteResults.length > 0 || topicResults.length > 0;
  const showActions = !searchQuery || !hasResults;

  /**
   * PERFORMANCE OPTIMIZATION:
   * Memoize handler functions to maintain referential equality
   * and prevent unnecessary re-renders of child components.
   */
  const handleNavigateToTab = useCallback((tabId: TabType) => {
    onNavigate(tabId);
    onClose();
  }, [onNavigate, onClose]);

  const handleCreateAction = useCallback(() => {
    onSearchQueryChange('');
    onClose();
  }, [onSearchQueryChange, onClose]);

  return (
    <motion.div
      variants={modeContentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Search Input */}
      <div className="relative flex items-center gap-3 px-4 py-3 border-b-2 border-white/30 bg-white/20">
        {/* Focus ring pulse effect */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              className="absolute inset-0 border-2 border-cyan-400/40 rounded-t-2xl pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </AnimatePresence>

        <Search className="w-5 h-5 text-gray-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Search anything or run a command..."
          className="flex-1 bg-transparent border-0 focus:outline-none text-base placeholder-gray-400 text-gray-900"
          autoFocus
        />
        {searchQuery && (
          <motion.button
            onClick={() => onSearchQueryChange('')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSearchQueryChange('');
              }
            }}
            className={`p-1 hover:bg-white/60 ${getRadiusClass('element')} transition-all duration-200`}
            whileHover={!prefersReducedMotion ? { scale: 1.1 } : undefined}
            whileTap={!prefersReducedMotion ? { scale: 0.9 } : undefined}
            transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-gray-400" />
          </motion.button>
        )}
        <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60">ESC</kbd>
      </div>

      {/* Results */}
      <div className="max-h-[60vh] overflow-y-auto">
        <div className="p-2">
          {/* Quick Actions - Always show when no search or no results */}
          {showActions && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Actions</div>
              <div className="space-y-1">
                <motion.button
                  onClick={() => handleNavigateToTab('capture')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateToTab('capture');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <div className={`w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 ${getRadiusClass('element')} flex items-center justify-center`}>
                    <Edit3 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Go to Capture</div>
                    <div className="text-xs text-gray-500">Create and process notes</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘1</kbd>
                </motion.button>

                <motion.button
                  onClick={() => handleNavigateToTab('tasks')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateToTab('tasks');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                 
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <div className={`w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 ${getRadiusClass('element')} flex items-center justify-center`}>
                    <CheckSquare className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Go to Tasks</div>
                    <div className="text-xs text-gray-500">Manage your tasks</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘2</kbd>
                </motion.button>

                <motion.button
                  onClick={() => handleNavigateToTab('notes')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateToTab('notes');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                 
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <div className={`w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 ${getRadiusClass('element')} flex items-center justify-center`}>
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Go to Notes</div>
                    <div className="text-xs text-gray-500">Browse all notes</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘3</kbd>
                </motion.button>

                <motion.button
                  onClick={() => handleNavigateToTab('sessions')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateToTab('sessions');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                 
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <div className={`w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 ${getRadiusClass('element')} flex items-center justify-center`}>
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Go to Sessions</div>
                    <div className="text-xs text-gray-500">Track work sessions</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘5</kbd>
                </motion.button>

                <motion.button
                  onClick={() => handleNavigateToTab('assistant')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateToTab('assistant');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                 
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <div className={`w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 ${getRadiusClass('element')} flex items-center justify-center`}>
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Ask AI Assistant</div>
                    <div className="text-xs text-gray-500">Get help with your notes</div>
                  </div>
                  <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘4</kbd>
                </motion.button>

                <div className="h-px bg-white/30 my-2" />

                <motion.button
                  onClick={handleCreateAction}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCreateAction();
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <Plus className="w-4 h-4 text-cyan-600" />
                  <div className="text-sm font-medium text-gray-900">Create New Task</div>
                </motion.button>

                <motion.button
                  onClick={handleCreateAction}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCreateAction();
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                 
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <Plus className="w-4 h-4 text-purple-600" />
                  <div className="text-sm font-medium text-gray-900">Create New Note</div>
                </motion.button>

                <motion.button
                  onClick={() => handleNavigateToTab('profile')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigateToTab('profile');
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left group`}
                 
                  whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                  transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                >
                  <Settings className="w-4 h-4 text-gray-600" />
                  <div className="text-sm font-medium text-gray-900">Settings</div>
                  <kbd className="px-2 py-1 bg-white/60 rounded text-xs font-mono text-gray-500 border border-white/60 opacity-0 group-hover:opacity-100">⌘,</kbd>
                </motion.button>
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
                  <motion.div
                    className="space-y-1"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {taskResults.map(task => (
                      <motion.button
                        key={task.id}
                        variants={staggerItem}
                        onClick={() => {
                          onOpenSidebar('task', task.id, task.title);
                          handleNavigateToTab('tasks');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left`}
                        whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                        transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
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
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Notes */}
              {noteResults.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</div>
                  <motion.div
                    className="space-y-1"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {noteResults.map(note => (
                      <motion.button
                        key={note.id}
                        variants={staggerItem}
                        onClick={() => {
                          onOpenSidebar('note', note.id, note.summary);
                          handleNavigateToTab('notes');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left`}
                        whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                        transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
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
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Topics */}
              {topicResults.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Topics</div>
                  <motion.div
                    className="space-y-1"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {topicResults.map(topic => (
                      <motion.button
                        key={topic.id}
                        variants={staggerItem}
                        onClick={() => handleNavigateToTab('notes')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/80 ${getRadiusClass('element')} transition-all text-left`}
                        whileTap={!prefersReducedMotion ? { scale: 0.98 } : undefined}
                        transition={prefersReducedMotion ? { duration: 0 } : contentSpring}
                      >
                        <Command className="w-4 h-4 text-cyan-600" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                          <div className="text-xs text-gray-500">{topic.noteCount} notes</div>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
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
    </motion.div>
  );
}

/**
 * PERFORMANCE OPTIMIZATION:
 * Memoize the component to prevent re-renders when props haven't changed.
 * This is especially important because SearchMode performs expensive
 * filter operations on context data.
 */
export const SearchMode = memo(SearchModeComponent);
