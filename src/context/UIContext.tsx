import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { TabType, Notification, ProcessingJob, SearchHistoryItem, UserPreferences, OnboardingState, NedMessage, NedMessageContent } from '../types';
import { getStorage } from '../services/storage';
import { generateId } from '../utils/helpers';

// UI State interface
interface UIState {
  // Navigation
  activeTab: TabType;
  currentZone: 'capture' | 'tasks' | 'notes' | 'sessions' | 'assistant' | 'profile';
  activeTopicId?: string;
  activeNoteId?: string;

  // Reference Panel
  referencePanelOpen: boolean;
  pinnedNotes: string[];

  // Background Processing
  backgroundProcessing: {
    active: boolean;
    queue: ProcessingJob[];
    completed: ProcessingJob[];
  };

  // Notifications
  notifications: Notification[];

  // Modals
  quickCaptureOpen: boolean;
  showCommandPalette: boolean;

  // Bulk Operations
  bulkSelectionMode: boolean;
  selectedTasks: string[];

  // Preferences
  preferences: UserPreferences;

  // Onboarding
  onboarding: OnboardingState;
  pendingReviewJobId?: string;

  // Ned Overlay
  nedOverlay: {
    isOpen: boolean;
  };

  // Ned Conversation
  nedConversation: {
    messages: NedMessage[];
  };

  // Sidebar
  sidebar: {
    isOpen: boolean;
    type: 'task' | 'note' | 'settings' | null;
    itemId?: string;
    width: number;
    history: Array<{
      type: 'task' | 'note' | 'settings';
      itemId?: string;
      label: string;
    }>;
  };

  // Search History
  searchHistory: SearchHistoryItem[];

  // Sub-menu Overlay
  showSubMenuOverlay: boolean;
}

type UIAction =
  // Navigation
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'SET_ZONE'; payload: UIState['currentZone'] }
  | { type: 'SET_ACTIVE_TOPIC'; payload: string | undefined }
  | { type: 'SET_ACTIVE_NOTE'; payload: string | undefined }

  // Reference Panel
  | { type: 'TOGGLE_REFERENCE_PANEL' }
  | { type: 'PIN_NOTE'; payload: string }
  | { type: 'UNPIN_NOTE'; payload: string }
  | { type: 'CLEAR_PINNED_NOTES' }

  // Notifications
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id' | 'createdAt' | 'read'> }
  | { type: 'DISMISS_NOTIFICATION'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }

  // Background Processing
  | { type: 'ADD_PROCESSING_JOB'; payload: Omit<ProcessingJob, 'id' | 'createdAt'> & Partial<Pick<ProcessingJob, 'id' | 'createdAt'>> }
  | { type: 'UPDATE_PROCESSING_JOB'; payload: { id: string; updates: Partial<ProcessingJob> } }
  | { type: 'COMPLETE_PROCESSING_JOB'; payload: { id: string; result: any } }
  | { type: 'ERROR_PROCESSING_JOB'; payload: { id: string; error: string } }
  | { type: 'REMOVE_PROCESSING_JOB'; payload: string }

  // Bulk Operations
  | { type: 'TOGGLE_BULK_SELECTION_MODE' }
  | { type: 'SELECT_TASK'; payload: string }
  | { type: 'DESELECT_TASK'; payload: string }
  | { type: 'SELECT_ALL_TASKS'; payload: string[] }
  | { type: 'CLEAR_TASK_SELECTION' }

  // Modals
  | { type: 'TOGGLE_QUICK_CAPTURE' }
  | { type: 'TOGGLE_COMMAND_PALETTE' }

  // Ned Overlay
  | { type: 'TOGGLE_NED_OVERLAY' }
  | { type: 'OPEN_NED_OVERLAY' }
  | { type: 'CLOSE_NED_OVERLAY' }

  // Review
  | { type: 'SET_PENDING_REVIEW_JOB'; payload: string | undefined }

  // Onboarding
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'RESET_ONBOARDING' }
  | { type: 'DISMISS_TOOLTIP'; payload: string }
  | { type: 'MARK_FEATURE_INTRODUCED'; payload: keyof OnboardingState['featureIntroductions'] }
  | { type: 'INCREMENT_ONBOARDING_STAT'; payload: keyof OnboardingState['stats'] }
  | { type: 'SHOW_FEATURE_TOOLTIP'; payload: string }
  | { type: 'INCREMENT_TOOLTIP_STAT'; payload: 'shown' | 'dismissed' }
  | { type: 'COMPLETE_FIRST_CAPTURE' }

  // Search History
  | { type: 'ADD_SEARCH_HISTORY'; payload: Omit<SearchHistoryItem, 'id' | 'timestamp'> }
  | { type: 'CLEAR_SEARCH_HISTORY' }

  // Preferences
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<UserPreferences> }

  // Sidebar
  | { type: 'OPEN_SIDEBAR'; payload: { type: 'task' | 'note' | 'settings'; itemId?: string; label: string } }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'RESIZE_SIDEBAR'; payload: number }
  | { type: 'POP_SIDEBAR_HISTORY' }

  // Ned Conversation
  | { type: 'ADD_NED_MESSAGE'; payload: NedMessage }
  | { type: 'UPDATE_NED_MESSAGE'; payload: { id: string; contents: NedMessageContent[] } }
  | { type: 'CLEAR_NED_CONVERSATION' }

  // Sub-menu Overlay
  | { type: 'TOGGLE_SUBMENU_OVERLAY' }
  | { type: 'SET_SUBMENU_OVERLAY'; payload: boolean }

  // Data management
  | { type: 'LOAD_UI_STATE'; payload: Partial<UIState> };

// Default states
const defaultPreferences: UserPreferences = {
  defaultView: {
    tasks: 'list',
    notes: 'grid',
  },
  filters: {
    tasks: {},
    notes: {},
  },
  theme: 'light',
  compactMode: false,
  defaultTab: 'capture',
  showReferencePanel: false,
  referencePanelWidth: 30,
  dateFormat: '12h',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekStartsOn: 'sunday',
  zoomLevel: 100,
};

const defaultOnboardingState: OnboardingState = {
  completed: false,
  currentStep: 0,
  dismissedTooltips: [],
  featureIntroductions: {
    captureBox: false,
    toggles: false,
    quickAdd: false,
    filters: false,
    inlineEdit: false,
    cmdK: false,
    backgroundProcessing: false,
    nedAssistant: false,
    referencePanel: false,
    sessions: false,
    taskDetailSidebar: false,
    taskViews: false,
  },
  stats: {
    captureCount: 0,
    taskCount: 0,
    sessionCount: 0,
    noteCount: 0,
    nedQueryCount: 0,
    tooltipsShown: 0,
    tooltipsDismissed: 0,
    lastActiveDate: new Date().toISOString(),
  },
  firstCaptureCompleted: false,
  interactiveTutorialShown: false,
};

const defaultState: UIState = {
  activeTab: 'capture',
  currentZone: 'capture',
  activeTopicId: undefined,
  activeNoteId: undefined,
  referencePanelOpen: false,
  pinnedNotes: [],
  backgroundProcessing: {
    active: false,
    queue: [],
    completed: [],
  },
  notifications: [],
  quickCaptureOpen: false,
  showCommandPalette: false,
  bulkSelectionMode: false,
  selectedTasks: [],
  preferences: defaultPreferences,
  onboarding: defaultOnboardingState,
  pendingReviewJobId: undefined,
  nedOverlay: {
    isOpen: false,
  },
  nedConversation: {
    messages: [],
  },
  sidebar: {
    isOpen: false,
    type: null,
    itemId: undefined,
    width: 35,
    history: [],
  },
  searchHistory: [],
  showSubMenuOverlay: false,
};

// Reducer (logic copied from AppContext)
function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    // Navigation
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_ZONE':
      return { ...state, currentZone: action.payload, activeTab: action.payload as TabType };

    case 'SET_ACTIVE_TOPIC':
      return { ...state, activeTopicId: action.payload };

    case 'SET_ACTIVE_NOTE':
      return { ...state, activeNoteId: action.payload };

    // Reference Panel
    case 'TOGGLE_REFERENCE_PANEL':
      return { ...state, referencePanelOpen: !state.referencePanelOpen };

    case 'PIN_NOTE': {
      const noteId = action.payload;
      if (state.pinnedNotes.includes(noteId)) return state;
      if (state.pinnedNotes.length >= 5) {
        // Max 5 pinned notes, remove oldest
        return {
          ...state,
          pinnedNotes: [...state.pinnedNotes.slice(1), noteId],
        };
      }
      return {
        ...state,
        pinnedNotes: [...state.pinnedNotes, noteId],
        referencePanelOpen: true,
      };
    }

    case 'UNPIN_NOTE':
      return {
        ...state,
        pinnedNotes: state.pinnedNotes.filter(id => id !== action.payload),
      };

    case 'CLEAR_PINNED_NOTES':
      return {
        ...state,
        pinnedNotes: [],
        referencePanelOpen: false,
      };

    // Notifications
    case 'ADD_NOTIFICATION': {
      const notification: Notification = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString(),
        read: false,
      };
      return {
        ...state,
        notifications: [...state.notifications, notification],
      };
    }

    case 'DISMISS_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };

    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notifications: [] };

    // Background Processing
    case 'ADD_PROCESSING_JOB': {
      const job: ProcessingJob = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        ...action.payload,
      };
      return {
        ...state,
        backgroundProcessing: {
          active: true,
          queue: [...state.backgroundProcessing.queue, job],
          completed: state.backgroundProcessing.completed,
        },
      };
    }

    case 'UPDATE_PROCESSING_JOB':
      return {
        ...state,
        backgroundProcessing: {
          ...state.backgroundProcessing,
          queue: state.backgroundProcessing.queue.map(job =>
            job.id === action.payload.id ? { ...job, ...action.payload.updates } : job
          ),
        },
      };

    case 'COMPLETE_PROCESSING_JOB': {
      const { id, result } = action.payload;
      const job = state.backgroundProcessing.queue.find(j => j.id === id);
      if (!job) return state;

      const completedJob: ProcessingJob = {
        ...job,
        status: 'complete',
        progress: 100,
        result,
        completedAt: new Date().toISOString(),
      };

      return {
        ...state,
        backgroundProcessing: {
          active: state.backgroundProcessing.queue.length > 1,
          queue: state.backgroundProcessing.queue.filter(j => j.id !== id),
          completed: [...state.backgroundProcessing.completed, completedJob],
        },
      };
    }

    case 'ERROR_PROCESSING_JOB': {
      const { id, error } = action.payload;
      const job = state.backgroundProcessing.queue.find(j => j.id === id);
      if (!job) return state;

      const erroredJob: ProcessingJob = {
        ...job,
        status: 'error',
        error,
        completedAt: new Date().toISOString(),
      };

      return {
        ...state,
        backgroundProcessing: {
          active: state.backgroundProcessing.queue.length > 1,
          queue: state.backgroundProcessing.queue.filter(j => j.id !== id),
          completed: [...state.backgroundProcessing.completed, erroredJob],
        },
      };
    }

    case 'REMOVE_PROCESSING_JOB':
      return {
        ...state,
        backgroundProcessing: {
          ...state.backgroundProcessing,
          queue: state.backgroundProcessing.queue.filter(j => j.id !== action.payload),
          completed: state.backgroundProcessing.completed.filter(j => j.id !== action.payload),
        },
      };

    // Bulk Operations
    case 'TOGGLE_BULK_SELECTION_MODE':
      return {
        ...state,
        bulkSelectionMode: !state.bulkSelectionMode,
        selectedTasks: !state.bulkSelectionMode ? [] : state.selectedTasks,
      };

    case 'SELECT_TASK': {
      const taskId = action.payload;
      if (state.selectedTasks.includes(taskId)) return state;
      return {
        ...state,
        selectedTasks: [...state.selectedTasks, taskId],
      };
    }

    case 'DESELECT_TASK':
      return {
        ...state,
        selectedTasks: state.selectedTasks.filter(id => id !== action.payload),
      };

    case 'SELECT_ALL_TASKS':
      return {
        ...state,
        selectedTasks: action.payload,
      };

    case 'CLEAR_TASK_SELECTION':
      return { ...state, selectedTasks: [] };

    // Modals
    case 'TOGGLE_QUICK_CAPTURE':
      return { ...state, quickCaptureOpen: !state.quickCaptureOpen };

    case 'TOGGLE_COMMAND_PALETTE':
      return { ...state, showCommandPalette: !state.showCommandPalette };

    // Ned Overlay
    case 'TOGGLE_NED_OVERLAY':
      return {
        ...state,
        nedOverlay: {
          isOpen: !state.nedOverlay.isOpen,
        },
      };

    case 'OPEN_NED_OVERLAY':
      return {
        ...state,
        nedOverlay: {
          isOpen: true,
        },
      };

    case 'CLOSE_NED_OVERLAY':
      return {
        ...state,
        nedOverlay: {
          isOpen: false,
        },
      };

    // Review
    case 'SET_PENDING_REVIEW_JOB':
      return { ...state, pendingReviewJobId: action.payload };

    // Onboarding
    case 'COMPLETE_ONBOARDING':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          completed: true,
        },
      };

    case 'RESET_ONBOARDING':
      return {
        ...state,
        onboarding: defaultOnboardingState,
      };

    case 'DISMISS_TOOLTIP': {
      const tooltipId = action.payload;
      if (state.onboarding.dismissedTooltips.includes(tooltipId)) return state;
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          dismissedTooltips: [...state.onboarding.dismissedTooltips, tooltipId],
        },
      };
    }

    case 'MARK_FEATURE_INTRODUCED':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          featureIntroductions: {
            ...state.onboarding.featureIntroductions,
            [action.payload]: true,
          },
        },
      };

    case 'INCREMENT_ONBOARDING_STAT': {
      const statKey = action.payload;
      const currentValue = state.onboarding.stats[statKey];

      if (typeof currentValue === 'number') {
        return {
          ...state,
          onboarding: {
            ...state.onboarding,
            stats: {
              ...state.onboarding.stats,
              [statKey]: currentValue + 1,
            },
          },
        };
      }
      return state;
    }

    case 'SHOW_FEATURE_TOOLTIP':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          stats: {
            ...state.onboarding.stats,
            tooltipsShown: state.onboarding.stats.tooltipsShown + 1,
          },
        },
      };

    case 'INCREMENT_TOOLTIP_STAT': {
      const statType = action.payload;
      const statKey = statType === 'shown' ? 'tooltipsShown' : 'tooltipsDismissed';
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          stats: {
            ...state.onboarding.stats,
            [statKey]: state.onboarding.stats[statKey] + 1,
          },
        },
      };
    }

    case 'COMPLETE_FIRST_CAPTURE':
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          firstCaptureCompleted: true,
        },
      };

    // Search History
    case 'ADD_SEARCH_HISTORY': {
      const item: SearchHistoryItem = {
        ...action.payload,
        id: generateId(),
        timestamp: new Date().toISOString(),
      };
      // Keep max 50 items
      const newHistory = [item, ...state.searchHistory].slice(0, 50);
      return { ...state, searchHistory: newHistory };
    }

    case 'CLEAR_SEARCH_HISTORY':
      return { ...state, searchHistory: [] };

    // Preferences
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
      };

    // Sidebar
    case 'OPEN_SIDEBAR': {
      const { type, itemId, label } = action.payload;
      const newHistory = [
        ...state.sidebar.history,
        { type, itemId, label }
      ].slice(-3);

      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          isOpen: true,
          type,
          itemId,
          history: newHistory,
        },
      };
    }

    case 'CLOSE_SIDEBAR':
      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          isOpen: false,
        },
      };

    case 'RESIZE_SIDEBAR':
      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          width: action.payload,
        },
      };

    case 'POP_SIDEBAR_HISTORY': {
      const newHistory = [...state.sidebar.history];
      newHistory.pop();
      const previous = newHistory[newHistory.length - 1];

      if (!previous) {
        return {
          ...state,
          sidebar: {
            ...state.sidebar,
            isOpen: false,
            history: [],
          },
        };
      }

      return {
        ...state,
        sidebar: {
          ...state.sidebar,
          type: previous.type,
          itemId: previous.itemId,
          history: newHistory,
        },
      };
    }

    // Ned Conversation
    case 'ADD_NED_MESSAGE':
      return {
        ...state,
        nedConversation: {
          messages: [...state.nedConversation.messages, action.payload],
        },
      };

    case 'UPDATE_NED_MESSAGE': {
      const messages = state.nedConversation.messages.map(msg =>
        msg.id === action.payload.id
          ? { ...msg, contents: action.payload.contents }
          : msg
      );
      return {
        ...state,
        nedConversation: {
          messages,
        },
      };
    }

    case 'CLEAR_NED_CONVERSATION':
      return {
        ...state,
        nedConversation: {
          messages: [],
        },
      };

    // Sub-menu Overlay
    case 'TOGGLE_SUBMENU_OVERLAY':
      return { ...state, showSubMenuOverlay: !state.showSubMenuOverlay };

    case 'SET_SUBMENU_OVERLAY':
      return { ...state, showSubMenuOverlay: action.payload };

    // Data management
    case 'LOAD_UI_STATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// Context
const UIContext = createContext<{
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
} | null>(null);

// Provider
export function UIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, defaultState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from storage on mount
  useEffect(() => {
    async function loadUIState() {
      try {
        const storage = await getStorage();
        const settings = await storage.load<any>('settings');

        if (settings && settings.ui) {
          dispatch({
            type: 'LOAD_UI_STATE',
            payload: {
              preferences: { ...defaultPreferences, ...(settings.ui.preferences || {}) },
              pinnedNotes: settings.ui.pinnedNotes || [],
              onboarding: { ...defaultOnboardingState, ...(settings.ui.onboarding || {}) },
            },
          });
        }

        // Load search history
        if (settings && settings.searchHistory) {
          dispatch({
            type: 'LOAD_UI_STATE',
            payload: {
              searchHistory: settings.searchHistory,
            },
          });
        }

        setHasLoaded(true);
      } catch (error) {
        console.error('Failed to load UI state:', error);
        setHasLoaded(true);
      }
    }
    loadUIState();
  }, []);

  // Save to storage on change (debounced 5 seconds)
  // Only save persistent state (preferences, onboarding, pinnedNotes, searchHistory)
  useEffect(() => {
    if (!hasLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const storage = await getStorage();
        // Load existing settings first to preserve other fields
        const existingSettings = await storage.load<any>('settings') || {};

        await storage.save('settings', {
          ...existingSettings,
          ui: {
            preferences: state.preferences,
            pinnedNotes: state.pinnedNotes,
            onboarding: state.onboarding,
          },
          searchHistory: state.searchHistory,
        });
        console.log('UI state saved to storage');
      } catch (error) {
        console.error('Failed to save UI state:', error);
      }
    }, 5000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasLoaded, state.preferences, state.pinnedNotes, state.onboarding, state.searchHistory]);

  return (
    <UIContext.Provider value={{ state, dispatch }}>
      {children}
    </UIContext.Provider>
  );
}

// Hook
export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }

  // Helper methods
  const addNotification = (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    context.dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  };

  const addProcessingJob = (job: Omit<ProcessingJob, 'id' | 'createdAt'>) => {
    context.dispatch({ type: 'ADD_PROCESSING_JOB', payload: job });
  };

  return {
    ...context,
    addNotification,
    addProcessingJob,
  };
}
