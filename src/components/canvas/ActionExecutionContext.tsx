/**
 * ActionExecutionContext
 *
 * Provides action execution capabilities to canvas action components.
 * Injects TasksContext and NotesContext handlers for creating/updating items.
 */

import React, { createContext, useContext } from 'react';
import type { Task, Note, ManualTaskData } from '../../types';
import { useTasks } from '../../context/TasksContext';
import { useNotes } from '../../context/NotesContext';
import { useUI } from '../../context/UIContext';

/**
 * Action execution handlers
 */
export interface ActionExecutionHandlers {
  // Task operations
  createTask: (data: ManualTaskData) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  getTasks: () => Task[];

  // Note operations
  createNote: (data: { title: string; content: string; tags?: string[]; topicIds?: string[] }) => Promise<void>;
  updateNote: (note: Note) => Promise<void>;
  getNotes: () => Note[];

  // UI feedback
  showNotification: (notification: {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
  }) => void;
}

/**
 * Context
 */
const ActionExecutionContext = createContext<ActionExecutionHandlers | null>(null);

/**
 * Hook to access action execution handlers
 */
export function useActionExecution(): ActionExecutionHandlers {
  const context = useContext(ActionExecutionContext);
  if (!context) {
    throw new Error('useActionExecution must be used within ActionExecutionProvider');
  }
  return context;
}

/**
 * Provider component
 */
export function ActionExecutionProvider({ children }: { children: React.ReactNode }) {
  const { state: tasksState, createManualTask, updateTask } = useTasks();
  const { state: notesState, createManualNote, updateNote } = useNotes();
  const { addNotification } = useUI();

  const handlers: ActionExecutionHandlers = {
    // Task operations
    createTask: async (data: ManualTaskData) => {
      try {
        createManualTask(data);
      } catch (error) {
        console.error('[ActionExecution] Failed to create task:', error);
        throw error;
      }
    },

    updateTask: async (task: Task) => {
      try {
        updateTask(task);
      } catch (error) {
        console.error('[ActionExecution] Failed to update task:', error);
        throw error;
      }
    },

    getTasks: () => tasksState.tasks,

    // Note operations
    createNote: async (data) => {
      try {
        createManualNote(data);
      } catch (error) {
        console.error('[ActionExecution] Failed to create note:', error);
        throw error;
      }
    },

    updateNote: async (note: Note) => {
      try {
        updateNote(note);
      } catch (error) {
        console.error('[ActionExecution] Failed to update note:', error);
        throw error;
      }
    },

    getNotes: () => notesState.notes,

    // UI feedback
    showNotification: (notification) => {
      addNotification(notification);
    },
  };

  return (
    <ActionExecutionContext.Provider value={handlers}>
      {children}
    </ActionExecutionContext.Provider>
  );
}
