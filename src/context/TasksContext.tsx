import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Task, ManualTaskData } from '../types';
import { getStorage } from '../services/storage';
import { generateId } from '../utils/helpers';
// QueryEngine removed - use UnifiedIndexManager for search operations
import { useRelationships } from './RelationshipContext';
import { EntityType, RelationshipType } from '../types/relationships';
import { normalizeTasks } from '../utils/entityMigration';
import { debug } from "../utils/debug";

// Tasks State
interface TasksState {
  tasks: Task[];
}

type TasksAction =
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'TOGGLE_TASK'; payload: string }
  | { type: 'BATCH_ADD_TASKS'; payload: Task[] }
  | { type: 'BATCH_UPDATE_TASKS'; payload: { ids: string[]; updates: Partial<Task> } }
  | { type: 'BATCH_DELETE_TASKS'; payload: string[] }
  | { type: 'CREATE_MANUAL_TASK'; payload: ManualTaskData }
  | { type: 'LOAD_TASKS'; payload: Task[] };

// Default state
const defaultState: TasksState = {
  tasks: [],
};

// Reducer
function tasksReducer(state: TasksState, action: TasksAction): TasksState {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id ? action.payload : task
        ),
      };

    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
      };

    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? {
                ...task,
                done: !task.done,
                status: !task.done ? 'done' : 'todo',
                completedAt: !task.done ? new Date().toISOString() : undefined,
              }
            : task
        ),
      };

    case 'BATCH_ADD_TASKS':
      return { ...state, tasks: [...state.tasks, ...action.payload] };

    case 'BATCH_UPDATE_TASKS': {
      const { ids, updates } = action.payload;
      return {
        ...state,
        tasks: state.tasks.map(task =>
          ids.includes(task.id) ? { ...task, ...updates } : task
        ),
      };
    }

    case 'BATCH_DELETE_TASKS':
      return {
        ...state,
        tasks: state.tasks.filter(task => !action.payload.includes(task.id)),
      };

    case 'CREATE_MANUAL_TASK': {
      const taskData = action.payload;
      const newTask: Task = {
        id: generateId(),
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'todo',
        done: taskData.status === 'done',
        dueDate: taskData.dueDate,
        tags: taskData.tags || [],
        createdBy: 'manual',
        createdAt: new Date().toISOString(),
        completedAt: taskData.status === 'done' ? new Date().toISOString() : undefined,
        relationships: [], // Empty for manual tasks
      };
      return { ...state, tasks: [...state.tasks, newTask] };
    }

    case 'LOAD_TASKS':
      return { ...state, tasks: action.payload };

    default:
      return state;
  }
}

// Context
const TasksContext = createContext<{
  state: TasksState;
  dispatch: React.Dispatch<TasksAction>;

  // Query Engine Methods (Phase 3.3)
  // queryTasks removed - use UnifiedIndexManager directly for search operations

  // Relationship helper methods (Phase C2)
  linkTaskToNote: (taskId: string, noteId: string) => Promise<void>;
  unlinkTaskFromNote: (taskId: string, noteId: string) => Promise<void>;
  linkTaskToSession: (taskId: string, sessionId: string) => Promise<void>;
  unlinkTaskFromSession: (taskId: string, sessionId: string) => Promise<void>;

  // Phase 5 method: Batch update
  batchUpdateTasks: (taskIds: string[], updates: Partial<Task>) => Promise<void>;
} | null>(null);

// Provider
export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, defaultState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get relationship context (may not be available during initial render)
  let relationshipsContext;
  try {
    relationshipsContext = useRelationships();
  } catch {
    // RelationshipContext not available yet - that's OK during migration
    relationshipsContext = null;
  }

  // Load from storage on mount
  useEffect(() => {
    async function loadTasks() {
      try {
        const storage = await getStorage();
        const tasks = await storage.load<Task[]>('tasks');

        if (Array.isArray(tasks)) {
          // Normalize tasks to ensure relationships array exists (backward compatibility)
          const normalizedTasks = normalizeTasks(tasks);
          dispatch({ type: 'LOAD_TASKS', payload: normalizedTasks });
        }

        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load tasks:', error);
        setHasLoaded(true);
      }
    }
    loadTasks();
  }, []);

  // Save to storage on change (debounced 5 seconds)
  useEffect(() => {
    if (!hasLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const storage = await getStorage();
        await storage.save('tasks', state.tasks);
        debug.log("Tasks saved to storage");
      } catch (error) {
        console.error('Failed to save tasks:', error);
      }
    }, 5000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasLoaded, state.tasks]);

  // REMOVED: queryTasks method (QueryEngine deprecated)
  // Use UnifiedIndexManager instead:
  //
  // import { getUnifiedIndexManager } from '../services/storage/UnifiedIndexManager';
  // const unifiedIndex = await getUnifiedIndexManager();
  // const result = await unifiedIndex.unifiedSearch({
  //   entityTypes: ['tasks'],
  //   query: 'search text',
  //   filters: { status: 'in_progress', priority: 'high' },
  //   limit: 20
  // });
  //
  // See: /docs/UNIFIED_INDEX_MANAGER_IMPLEMENTATION_SUMMARY.md

  // Relationship helper methods (Phase C2)
  const linkTaskToNote = React.useCallback(async (taskId: string, noteId: string) => {
    if (!relationshipsContext) {
      console.warn('[TasksContext] RelationshipContext not available - skipping linkTaskToNote');
      return;
    }

    try {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: taskId,
        targetType: EntityType.NOTE,
        targetId: noteId,
        type: RelationshipType.TASK_NOTE,
        metadata: { source: 'manual', createdAt: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[TasksContext] Failed to link task to note:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const unlinkTaskFromNote = React.useCallback(async (taskId: string, noteId: string) => {
    if (!relationshipsContext) {
      console.warn('[TasksContext] RelationshipContext not available - skipping unlinkTaskFromNote');
      return;
    }

    try {
      const relationships = relationshipsContext.getRelationships(taskId, RelationshipType.TASK_NOTE);
      const rel = relationships.find(r => r.targetId === noteId);
      if (rel) {
        await relationshipsContext.removeRelationship(rel.id);
      }
    } catch (error) {
      console.error('[TasksContext] Failed to unlink task from note:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const linkTaskToSession = React.useCallback(async (taskId: string, sessionId: string) => {
    if (!relationshipsContext) {
      console.warn('[TasksContext] RelationshipContext not available - skipping linkTaskToSession');
      return;
    }

    try {
      await relationshipsContext.addRelationship({
        sourceType: EntityType.TASK,
        sourceId: taskId,
        targetType: EntityType.SESSION,
        targetId: sessionId,
        type: RelationshipType.TASK_SESSION,
        metadata: { source: 'manual', createdAt: new Date().toISOString() },
      });
    } catch (error) {
      console.error('[TasksContext] Failed to link task to session:', error);
      throw error;
    }
  }, [relationshipsContext]);

  const unlinkTaskFromSession = React.useCallback(async (taskId: string, sessionId: string) => {
    if (!relationshipsContext) {
      console.warn('[TasksContext] RelationshipContext not available - skipping unlinkTaskFromSession');
      return;
    }

    try {
      const relationships = relationshipsContext.getRelationships(taskId, RelationshipType.TASK_SESSION);
      const rel = relationships.find(r => r.targetId === sessionId);
      if (rel) {
        await relationshipsContext.removeRelationship(rel.id);
      }
    } catch (error) {
      console.error('[TasksContext] Failed to unlink task from session:', error);
      throw error;
    }
  }, [relationshipsContext]);

  // Phase 5: Batch update tasks
  const batchUpdateTasks = React.useCallback(async (
    taskIds: string[],
    updates: Partial<Task>
  ): Promise<void> => {
    dispatch({
      type: 'BATCH_UPDATE_TASKS',
      payload: { ids: taskIds, updates }
    });
  }, []);

  return (
    <TasksContext.Provider value={{
      state,
      dispatch,
      // queryTasks removed - use UnifiedIndexManager
      linkTaskToNote,
      unlinkTaskFromNote,
      linkTaskToSession,
      unlinkTaskFromSession,
      batchUpdateTasks,
    }}>
      {children}
    </TasksContext.Provider>
  );
}

// Hook
export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within TasksProvider');
  }

  // Get relationship context for enhanced task operations
  let relationshipsContext;
  try {
    relationshipsContext = useRelationships();
  } catch {
    relationshipsContext = null;
  }

  // Helper methods
  const addTask = async (task: Task) => {
    context.dispatch({ type: 'ADD_TASK', payload: task });
  };

  const updateTask = (task: Task) => {
    context.dispatch({ type: 'UPDATE_TASK', payload: task });
  };

  const deleteTask = async (taskId: string) => {
    // Delete relationships first if RelationshipContext is available
    if (relationshipsContext) {
      try {
        const relationships = relationshipsContext.getRelationships(taskId);
        for (const rel of relationships) {
          await relationshipsContext.removeRelationship(rel.id);
        }
      } catch (error) {
        console.error('[TasksContext] Failed to delete task relationships:', error);
      }
    }

    // Delete task from state
    context.dispatch({ type: 'DELETE_TASK', payload: taskId });
  };

  const createManualTask = (data: ManualTaskData) => {
    context.dispatch({ type: 'CREATE_MANUAL_TASK', payload: data });
  };

  const batchUpdateTasks = React.useCallback(async (
    taskIds: string[],
    updates: Partial<Task>
  ): Promise<void> => {
    context.dispatch({
      type: 'BATCH_UPDATE_TASKS',
      payload: { ids: taskIds, updates }
    });
  }, [context]);

  return {
    ...context,
    addTask,
    updateTask,
    deleteTask,
    createManualTask,
    batchUpdateTasks,
  };
}
