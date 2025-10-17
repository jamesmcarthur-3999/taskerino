/**
 * useNavActions - Action Handlers Hook
 *
 * Extracts all action handler functions from TopNavigation component.
 * Provides unified interface for navigation interactions.
 */

import { useCallback } from 'react';
import type { TabType, Task } from '../../types';
import { useUI } from '../../context/UIContext';
import { useTasks } from '../../context/TasksContext';
import { useNotes } from '../../context/NotesContext';
import type { IslandState } from './types';
import { generateId } from '../../utils/helpers';

/**
 * Island state management interface
 */
export interface IslandStateHook {
  islandState: IslandState;
  setIslandState: React.Dispatch<React.SetStateAction<IslandState>>;
  taskTitle: string;
  setTaskTitle: React.Dispatch<React.SetStateAction<string>>;
  taskDueDate: string;
  setTaskDueDate: React.Dispatch<React.SetStateAction<string>>;
  noteInput: string;
  setNoteInput: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  showTaskSuccess: boolean;
  setShowTaskSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  sessionDescription: string;
  setSessionDescription: React.Dispatch<React.SetStateAction<string>>;
  setCreatedTaskId: React.Dispatch<React.SetStateAction<string | null>>;
}

/**
 * Return type for navigation actions hook
 */
export interface NavActions {
  handleTabClick: (tabId: TabType) => void;
  handleQuickAction: (tabId: TabType, e: React.MouseEvent) => void;
  handleProcessingBadgeClick: (e: React.MouseEvent) => void;
  handleSessionBadgeClick: (e: React.MouseEvent) => void;
  closeIsland: () => void;
  handleProfileClick: () => void;
  handleSearchClick: () => void;
  handleCreateQuickTask: () => void;
  handleSaveQuickNote: () => Promise<void>;
  handleSendToAI: () => Promise<void>;
  handleViewTask: (taskId: string | null) => void;
}

/**
 * Hook to manage navigation actions
 *
 * Extracts all action handlers from TopNavigation component.
 * Maintains exact same logic and dependencies as original.
 *
 * @param islandHook - Island state management hook
 * @param searchInputRef - Ref for search input element
 * @returns Navigation action handlers
 */
export function useNavActions(
  islandHook: IslandStateHook,
  searchInputRef: React.RefObject<HTMLInputElement>
): NavActions {
  const { dispatch: uiDispatch, addNotification, addProcessingJob } = useUI();
  const { addTask } = useTasks();
  const { addNote } = useNotes();

  const {
    islandState,
    setIslandState,
    setTaskTitle,
    setTaskDueDate,
    setNoteInput,
    setSearchQuery,
    setShowTaskSuccess,
    setSessionDescription,
    taskTitle,
    taskDueDate,
    noteInput,
    setCreatedTaskId,
  } = islandHook;

  /**
   * Handle tab click (line 87)
   */
  const handleTabClick = useCallback(
    (tabId: TabType) => {
      uiDispatch({ type: 'SET_ACTIVE_TAB', payload: tabId });
    },
    [uiDispatch]
  );

  /**
   * Handle quick action button click (line 91)
   */
  const handleQuickAction = useCallback(
    (tabId: TabType, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (tabId === 'tasks') {
        setIslandState(prev => prev === 'task-expanded' ? 'collapsed' : 'task-expanded');
      } else if (tabId === 'notes') {
        setIslandState(prev => prev === 'note-expanded' ? 'collapsed' : 'note-expanded');
      } else if (tabId === 'sessions') {
        setIslandState(prev => prev === 'session-expanded' ? 'collapsed' : 'session-expanded');
      }
    },
    [setIslandState]
  );

  /**
   * Handle processing badge click (line 104)
   */
  const handleProcessingBadgeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIslandState(prev => prev === 'processing-expanded' ? 'collapsed' : 'processing-expanded');
    },
    [setIslandState]
  );

  /**
   * Handle session badge click (line 110)
   */
  const handleSessionBadgeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIslandState(prev => prev === 'session-expanded' ? 'collapsed' : 'session-expanded');
    },
    [setIslandState]
  );

  /**
   * Close island and reset all state (line 116)
   */
  const closeIsland = useCallback(() => {
    setIslandState('collapsed');
    setTaskTitle('');
    setTaskDueDate('');
    setNoteInput('');
    setSearchQuery('');
    setShowTaskSuccess(false);
    setSessionDescription('');
  }, [
    setIslandState,
    setTaskTitle,
    setTaskDueDate,
    setNoteInput,
    setSearchQuery,
    setShowTaskSuccess,
    setSessionDescription,
  ]);

  /**
   * Handle profile button click (line 126)
   */
  const handleProfileClick = useCallback(() => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'profile' });
  }, [uiDispatch]);

  /**
   * Handle search button click (line 130)
   */
  const handleSearchClick = useCallback(() => {
    if (islandState === 'search-expanded') {
      closeIsland();
    } else {
      setIslandState('search-expanded');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [islandState, closeIsland, setIslandState, searchInputRef]);

  /**
   * Create quick task (line 317)
   */
  const handleCreateQuickTask = useCallback(() => {
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

    addTask(newTask);
    setCreatedTaskId(newTask.id);
    setShowTaskSuccess(true);
    setTaskTitle('');
    setTaskDueDate('');

    // Auto-hide success after 2s
    setTimeout(() => {
      closeIsland();
    }, 2000);
  }, [
    taskTitle,
    taskDueDate,
    addTask,
    setCreatedTaskId,
    setShowTaskSuccess,
    setTaskTitle,
    setTaskDueDate,
    closeIsland,
  ]);

  /**
   * View created task (line 343)
   */
  const handleViewTask = useCallback(
    (taskId: string | null) => {
      if (taskId) {
        uiDispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: taskId, label: 'Task Details' } });
        uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'tasks' });
        closeIsland();
      }
    },
    [uiDispatch, closeIsland]
  );

  /**
   * Save quick note (line 351)
   */
  const handleSaveQuickNote = useCallback(async () => {
    if (!noteInput.trim()) return;

    const newNote = {
      id: generateId(),
      content: noteInput,
      summary: noteInput.substring(0, 100),
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      source: 'thought' as const,
      tags: [],
    };

    addNote(newNote);

    addNotification({
      type: 'success',
      title: 'Quick Note Saved',
      message: 'Your note has been saved to notes',
    });

    closeIsland();
  }, [noteInput, addNote, addNotification, closeIsland]);

  /**
   * Send note to AI processing (line 375)
   */
  const handleSendToAI = useCallback(async () => {
    if (!noteInput.trim()) return;

    addProcessingJob({
      type: 'note',
      input: noteInput,
      status: 'queued',
      progress: 0,
    });

    closeIsland();
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
  }, [noteInput, addProcessingJob, closeIsland, uiDispatch]);

  return {
    handleTabClick,
    handleQuickAction,
    handleProcessingBadgeClick,
    handleSessionBadgeClick,
    closeIsland,
    handleProfileClick,
    handleSearchClick,
    handleCreateQuickTask,
    handleSaveQuickNote,
    handleSendToAI,
    handleViewTask,
  };
}
