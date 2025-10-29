/**
 * useNavData - Data Aggregation Hook
 *
 * Aggregates and memoizes data from multiple contexts for TopNavigation.
 * Extracts all useMemo blocks from the original TopNavigation component.
 */

import { useMemo } from 'react';
import { useUI } from '../../context/UIContext';
import { useTasks } from '../../context/TasksContext';
import { useNotes } from '../../context/NotesContext';
import { useSessionList } from '../../context/SessionListContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { useEntities } from '../../context/EntitiesContext';

/**
 * Return type for navigation data hook
 */
export interface NavData {
  // Active tasks count
  activeTasks: number;

  // Processing data
  processingData: {
    processingJobs: any[];
    completedJobs: any[];
    processingCount: number;
    hasActiveProcessing: boolean;
    hasCompletedItems: boolean;
  };

  // Session data
  sessionData: {
    activeSession: any | null;
    isSessionActive: boolean;
    isSessionPaused: boolean;
  };

  // Notification data
  notificationData: {
    unreadNotifications: any[];
    hasUnreadNotifications: boolean;
  };

  // Raw data for modes
  tasks: any[];
  notes: any[];
  topics: any[];
}

/**
 * Hook to aggregate navigation data from all contexts
 *
 * Maintains exact same memoization and dependencies as original TopNavigation.
 * All useMemo blocks extracted from lines 142-183.
 *
 * @returns Aggregated navigation data
 */
export function useNavData(): NavData {
  const { state: uiState } = useUI();
  const { state: tasksState } = useTasks();
  const { state: notesState } = useNotes();
  const { sessions } = useSessionList();
  const { activeSessionId } = useActiveSession();
  const { state: entitiesState } = useEntities();

  // Count of undone tasks (line 142-145)
  const activeTasks = useMemo(
    () => tasksState.tasks.filter(t => !t.done).length,
    [tasksState.tasks]
  );

  // Processing counts and flags (lines 147-158)
  const processingData = useMemo(() => {
    const processingJobs = uiState.backgroundProcessing.queue.filter(
      j => j.status === 'processing' || j.status === 'queued'
    );
    const completedJobs = uiState.backgroundProcessing.completed;
    return {
      processingJobs,
      completedJobs,
      processingCount: processingJobs.length + completedJobs.length,
      hasActiveProcessing: processingJobs.length > 0,
      hasCompletedItems: completedJobs.length > 0,
    };
  }, [uiState.backgroundProcessing.queue, uiState.backgroundProcessing.completed]);

  // Session info (lines 162-172)
  const sessionData = useMemo(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId);
    return {
      activeSession,
      isSessionActive: activeSession?.status === 'active',
      isSessionPaused: activeSession?.status === 'paused',
    };
  }, [sessions, activeSessionId]);

  // Notifications (lines 174-183)
  const notificationData = useMemo(() => {
    const unreadNotifications = uiState.notifications.filter(n => !n.read);
    return {
      unreadNotifications,
      hasUnreadNotifications: unreadNotifications.length > 0,
    };
  }, [uiState.notifications]);

  return {
    activeTasks,
    processingData,
    sessionData,
    notificationData,
    tasks: tasksState.tasks,
    notes: notesState.notes,
    topics: entitiesState.topics,
  };
}
