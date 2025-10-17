/**
 * useIslandState Hook
 *
 * Manages the state of the navigation island (collapsed/expanded modes)
 * and all mode-specific state variables.
 */

import { useState, useCallback } from 'react';
import type { IslandState } from '../types';

export function useIslandState() {
  // Island state
  const [islandState, setIslandState] = useState<IslandState>('collapsed');

  // TaskMode state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [showTaskSuccess, setShowTaskSuccess] = useState(false);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  // NoteMode state
  const [noteInput, setNoteInput] = useState('');

  // SearchMode state
  const [searchQuery, setSearchQuery] = useState('');

  // SessionMode state
  const [sessionDescription, setSessionDescription] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const closeIsland = useCallback(() => {
    setIslandState('collapsed');
  }, []);

  const openIsland = useCallback((state: IslandState) => {
    setIslandState(state);
  }, []);

  const toggleIsland = useCallback((state: IslandState) => {
    setIslandState(prev => prev === state ? 'collapsed' : state);
  }, []);

  return {
    // Island state
    islandState,
    setIslandState,
    closeIsland,
    openIsland,
    toggleIsland,
    isExpanded: islandState !== 'collapsed',

    // TaskMode state
    taskTitle,
    setTaskTitle,
    taskDueDate,
    setTaskDueDate,
    showTaskSuccess,
    setShowTaskSuccess,
    createdTaskId,
    setCreatedTaskId,

    // NoteMode state
    noteInput,
    setNoteInput,

    // SearchMode state
    searchQuery,
    setSearchQuery,

    // SessionMode state
    sessionDescription,
    setSessionDescription,
    countdown,
    setCountdown,
    isStarting,
    setIsStarting,
  };
}
