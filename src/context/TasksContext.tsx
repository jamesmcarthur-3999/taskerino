import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Task, ManualTaskData } from '../types';
import { getStorage } from '../services/storage';
import { generateId } from '../utils/helpers';

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
        topicId: taskData.topicId,
        tags: taskData.tags,
        createdBy: 'manual',
        createdAt: new Date().toISOString(),
        completedAt: taskData.status === 'done' ? new Date().toISOString() : undefined,
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
} | null>(null);

// Provider
export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, defaultState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from storage on mount
  useEffect(() => {
    async function loadTasks() {
      try {
        const storage = await getStorage();
        const tasks = await storage.load<Task[]>('tasks');

        if (Array.isArray(tasks)) {
          dispatch({ type: 'LOAD_TASKS', payload: tasks });
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
        console.log('Tasks saved to storage');
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

  return (
    <TasksContext.Provider value={{ state, dispatch }}>
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

  // Helper methods
  const addTask = (task: Task) => {
    context.dispatch({ type: 'ADD_TASK', payload: task });
  };

  const updateTask = (task: Task) => {
    context.dispatch({ type: 'UPDATE_TASK', payload: task });
  };

  const createManualTask = (data: ManualTaskData) => {
    context.dispatch({ type: 'CREATE_MANUAL_TASK', payload: data });
  };

  return {
    ...context,
    addTask,
    updateTask,
    createManualTask,
  };
}
