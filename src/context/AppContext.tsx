import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Topic, Company, Contact, Note, Task, AppState, TabType, Notification, ProcessingJob, SearchHistoryItem, ManualNoteData, ManualTopicData, ManualTaskData, NedMessage, NedMessageContent } from '../types';
import { generateId } from '../utils/helpers';

type AppAction =
  // Company actions
  | { type: 'ADD_COMPANY'; payload: Company }
  | { type: 'UPDATE_COMPANY'; payload: Company }
  | { type: 'DELETE_COMPANY'; payload: string }

  // Contact actions
  | { type: 'ADD_CONTACT'; payload: Contact }
  | { type: 'UPDATE_CONTACT'; payload: Contact }
  | { type: 'DELETE_CONTACT'; payload: string }

  // Topic actions (for "other" category)
  | { type: 'ADD_TOPIC'; payload: Topic }
  | { type: 'UPDATE_TOPIC'; payload: Topic }
  | { type: 'DELETE_TOPIC'; payload: string }
  | { type: 'CREATE_MANUAL_TOPIC'; payload: ManualTopicData }

  // Note actions
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: Note }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'BATCH_ADD_NOTES'; payload: Note[] }
  | { type: 'CREATE_MANUAL_NOTE'; payload: ManualNoteData }

  // Task actions
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'TOGGLE_TASK'; payload: string }
  | { type: 'BATCH_ADD_TASKS'; payload: Task[] }
  | { type: 'BATCH_UPDATE_TASKS'; payload: { ids: string[]; updates: Partial<Task> } }
  | { type: 'BATCH_DELETE_TASKS'; payload: string[] }
  | { type: 'CREATE_MANUAL_TASK'; payload: ManualTaskData }

  // UI State - Navigation
  | { type: 'SET_ACTIVE_TAB'; payload: TabType }
  | { type: 'SET_ZONE'; payload: AppState['currentZone'] }
  | { type: 'SET_ACTIVE_TOPIC'; payload: string | undefined }
  | { type: 'SET_ACTIVE_NOTE'; payload: string | undefined }

  // UI State - Reference Panel
  | { type: 'TOGGLE_REFERENCE_PANEL' }
  | { type: 'PIN_NOTE'; payload: string }
  | { type: 'UNPIN_NOTE'; payload: string }
  | { type: 'CLEAR_PINNED_NOTES' }

  // UI State - Notifications
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id' | 'createdAt' | 'read'> }
  | { type: 'DISMISS_NOTIFICATION'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' }

  // UI State - Background Processing
  | { type: 'ADD_PROCESSING_JOB'; payload: Omit<ProcessingJob, 'id' | 'createdAt'> & Partial<Pick<ProcessingJob, 'id' | 'createdAt'>> }
  | { type: 'UPDATE_PROCESSING_JOB'; payload: { id: string; updates: Partial<ProcessingJob> } }
  | { type: 'COMPLETE_PROCESSING_JOB'; payload: { id: string; result: any } }
  | { type: 'ERROR_PROCESSING_JOB'; payload: { id: string; error: string } }
  | { type: 'REMOVE_PROCESSING_JOB'; payload: string }

  // UI State - Bulk Operations
  | { type: 'TOGGLE_BULK_SELECTION_MODE' }
  | { type: 'SELECT_TASK'; payload: string }
  | { type: 'DESELECT_TASK'; payload: string }
  | { type: 'SELECT_ALL_TASKS'; payload: string[] }
  | { type: 'CLEAR_TASK_SELECTION' }

  // UI State - Modals
  | { type: 'TOGGLE_QUICK_CAPTURE' }
  | { type: 'TOGGLE_COMMAND_PALETTE' }

  // UI State - Onboarding
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'RESET_ONBOARDING' }
  | { type: 'DISMISS_TOOLTIP'; payload: string }
  | { type: 'MARK_FEATURE_INTRODUCED'; payload: keyof AppState['ui']['onboarding']['featureIntroductions'] }
  | { type: 'INCREMENT_ONBOARDING_STAT'; payload: keyof AppState['ui']['onboarding']['stats'] }

  // Search History
  | { type: 'ADD_SEARCH_HISTORY'; payload: Omit<SearchHistoryItem, 'id' | 'timestamp'> }
  | { type: 'CLEAR_SEARCH_HISTORY' }

  // Preferences
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<AppState['ui']['preferences']> }

  // Sidebar actions
  | { type: 'OPEN_SIDEBAR'; payload: { type: 'task' | 'note' | 'settings'; itemId?: string; label: string } }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'RESIZE_SIDEBAR'; payload: number }
  | { type: 'POP_SIDEBAR_HISTORY' }

  // Settings
  | { type: 'UPDATE_AI_SETTINGS'; payload: Partial<AppState['aiSettings']> }
  | { type: 'UPDATE_LEARNING_SETTINGS'; payload: Partial<AppState['learningSettings']> }
  | { type: 'UPDATE_USER_PROFILE'; payload: Partial<AppState['userProfile']> }
  | { type: 'UPDATE_NED_SETTINGS'; payload: Partial<AppState['nedSettings']> }
  | { type: 'GRANT_NED_PERMISSION'; payload: { toolName: string; level: 'forever' | 'session' | 'always-ask' } }
  | { type: 'REVOKE_NED_PERMISSION'; payload: string }
  | { type: 'CLEAR_SESSION_PERMISSIONS' }

  // Ned Conversation actions
  | { type: 'ADD_NED_MESSAGE'; payload: NedMessage }
  | { type: 'UPDATE_NED_MESSAGE'; payload: { id: string; contents: NedMessageContent[] } }
  | { type: 'CLEAR_NED_CONVERSATION' }

  // Data management
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };

const defaultAISettings: AppState['aiSettings'] = {
  systemInstructions: `You are a helpful assistant that organizes notes and extracts actionable tasks. Be concise and focus on what matters.`,
  autoMergeNotes: true,
  autoExtractTasks: true,
};

const defaultLearningSettings: AppState['learningSettings'] = {
  enabled: true,
  confirmationPoints: 10,
  rejectionPenalty: 20,
  applicationBonus: 1,
  flagMultiplier: 1.5,
  timeDecayDays: 30,
  timeDecayRate: 0.5,
  thresholds: {
    deprecated: 10,
    active: 50,
    rule: 80,
  },
};

const defaultUserProfile: AppState['userProfile'] = {
  name: '',
};

const defaultLearnings: AppState['learnings'] = {
  userId: 'default',
  profileName: 'Personal',
  learnings: [],
  stats: {
    totalLearnings: 0,
    activeRules: 0,
    experimentalPatterns: 0,
    observations: 0,
  },
};

const defaultPreferences: AppState['ui']['preferences'] = {
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
};

const defaultOnboardingState: AppState['ui']['onboarding'] = {
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
  },
  stats: {
    captureCount: 0,
    taskCount: 0,
    sessionCount: 0,
  },
};

const defaultNedSettings: AppState['nedSettings'] = {
  chattiness: 'balanced',
  showThinking: false,
  permissions: [],
  sessionPermissions: [],
  tokenUsage: {
    total: 0,
    thisMonth: 0,
    estimatedCost: 0,
  },
};

const defaultUIState: AppState['ui'] = {
  activeTab: 'capture',
  referencePanelOpen: false,
  pinnedNotes: [],
  backgroundProcessing: {
    active: false,
    queue: [],
    completed: [],
  },
  notifications: [],
  quickCaptureOpen: false,
  preferences: defaultPreferences,
  bulkSelectionMode: false,
  selectedTasks: [],
  showCommandPalette: false,
  onboarding: defaultOnboardingState,
};

const initialState: AppState = {
  companies: [],
  contacts: [],
  topics: [],
  notes: [],
  tasks: [],
  ui: defaultUIState,
  currentZone: 'capture',
  searchHistory: [],
  userProfile: defaultUserProfile,
  aiSettings: defaultAISettings,
  learningSettings: defaultLearningSettings,
  learnings: defaultLearnings,
  nedSettings: defaultNedSettings,
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
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Company actions
    case 'ADD_COMPANY':
      return { ...state, companies: [...state.companies, action.payload] };

    case 'UPDATE_COMPANY':
      return {
        ...state,
        companies: state.companies.map(company =>
          company.id === action.payload.id ? action.payload : company
        ),
      };

    case 'DELETE_COMPANY':
      return {
        ...state,
        companies: state.companies.filter(company => company.id !== action.payload),
        // Remove this companyId from all notes
        notes: state.notes.map(note => ({
          ...note,
          companyIds: note.companyIds?.filter(id => id !== action.payload),
        })),
      };

    // Contact actions
    case 'ADD_CONTACT':
      return { ...state, contacts: [...state.contacts, action.payload] };

    case 'UPDATE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.map(contact =>
          contact.id === action.payload.id ? action.payload : contact
        ),
      };

    case 'DELETE_CONTACT':
      return {
        ...state,
        contacts: state.contacts.filter(contact => contact.id !== action.payload),
        // Remove this contactId from all notes
        notes: state.notes.map(note => ({
          ...note,
          contactIds: note.contactIds?.filter(id => id !== action.payload),
        })),
      };

    // Topic actions
    case 'ADD_TOPIC':
      return { ...state, topics: [...state.topics, action.payload] };

    case 'UPDATE_TOPIC':
      return {
        ...state,
        topics: state.topics.map(topic =>
          topic.id === action.payload.id ? action.payload : topic
        ),
      };

    case 'DELETE_TOPIC':
      return {
        ...state,
        topics: state.topics.filter(topic => topic.id !== action.payload),
        // Remove this topicId from all notes (handle both legacy topicId and new topicIds array)
        notes: state.notes.map(note => ({
          ...note,
          topicId: note.topicId === action.payload ? undefined : note.topicId,
          topicIds: note.topicIds?.filter(id => id !== action.payload),
        })),
        tasks: state.tasks.filter(task => task.topicId !== action.payload),
      };

    // Note actions
    case 'ADD_NOTE': {
      // Update noteCount for all linked entities (companies, contacts, topics)
      const note = action.payload;
      const timestamp = note.timestamp;

      // Get all entity IDs this note is linked to
      const linkedCompanyIds = note.companyIds || [];
      const linkedContactIds = note.contactIds || [];
      const linkedTopicIds = note.topicIds || [];
      // Also handle legacy topicId
      if (note.topicId && !linkedTopicIds.includes(note.topicId)) {
        linkedTopicIds.push(note.topicId);
      }

      return {
        ...state,
        notes: [...state.notes, note],
        companies: state.companies.map(company =>
          linkedCompanyIds.includes(company.id)
            ? { ...company, noteCount: company.noteCount + 1, lastUpdated: timestamp }
            : company
        ),
        contacts: state.contacts.map(contact =>
          linkedContactIds.includes(contact.id)
            ? { ...contact, noteCount: contact.noteCount + 1, lastUpdated: timestamp }
            : contact
        ),
        topics: state.topics.map(topic =>
          linkedTopicIds.includes(topic.id)
            ? { ...topic, noteCount: topic.noteCount + 1, lastUpdated: timestamp }
            : topic
        ),
      };
    }

    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map(note =>
          note.id === action.payload.id ? action.payload : note
        ),
      };

    case 'DELETE_NOTE': {
      const deletedNote = state.notes.find(n => n.id === action.payload);
      if (!deletedNote) return state;

      // Get all entity IDs this note was linked to
      const linkedCompanyIds = deletedNote.companyIds || [];
      const linkedContactIds = deletedNote.contactIds || [];
      const linkedTopicIds = deletedNote.topicIds || [];
      // Also handle legacy topicId
      if (deletedNote.topicId && !linkedTopicIds.includes(deletedNote.topicId)) {
        linkedTopicIds.push(deletedNote.topicId);
      }

      return {
        ...state,
        notes: state.notes.filter(note => note.id !== action.payload),
        companies: state.companies.map(company =>
          linkedCompanyIds.includes(company.id)
            ? { ...company, noteCount: Math.max(0, company.noteCount - 1) }
            : company
        ),
        contacts: state.contacts.map(contact =>
          linkedContactIds.includes(contact.id)
            ? { ...contact, noteCount: Math.max(0, contact.noteCount - 1) }
            : contact
        ),
        topics: state.topics.map(topic =>
          linkedTopicIds.includes(topic.id)
            ? { ...topic, noteCount: Math.max(0, topic.noteCount - 1) }
            : topic
        ),
      };
    }

    case 'BATCH_ADD_NOTES': {
      // Track updates for all affected entities (companies, contacts, topics)
      const companyUpdates = new Map<string, { count: number; lastUpdated: string }>();
      const contactUpdates = new Map<string, { count: number; lastUpdated: string }>();
      const topicUpdates = new Map<string, { count: number; lastUpdated: string }>();

      action.payload.forEach(note => {
        const timestamp = note.timestamp;

        // Process company IDs
        (note.companyIds || []).forEach(companyId => {
          const existing = companyUpdates.get(companyId);
          if (!existing || timestamp > existing.lastUpdated) {
            companyUpdates.set(companyId, {
              count: (existing?.count || 0) + 1,
              lastUpdated: timestamp,
            });
          } else {
            companyUpdates.set(companyId, {
              ...existing,
              count: existing.count + 1,
            });
          }
        });

        // Process contact IDs
        (note.contactIds || []).forEach(contactId => {
          const existing = contactUpdates.get(contactId);
          if (!existing || timestamp > existing.lastUpdated) {
            contactUpdates.set(contactId, {
              count: (existing?.count || 0) + 1,
              lastUpdated: timestamp,
            });
          } else {
            contactUpdates.set(contactId, {
              ...existing,
              count: existing.count + 1,
            });
          }
        });

        // Process topic IDs (including legacy topicId)
        const allTopicIds = [...(note.topicIds || [])];
        if (note.topicId && !allTopicIds.includes(note.topicId)) {
          allTopicIds.push(note.topicId);
        }
        allTopicIds.forEach(topicId => {
          const existing = topicUpdates.get(topicId);
          if (!existing || timestamp > existing.lastUpdated) {
            topicUpdates.set(topicId, {
              count: (existing?.count || 0) + 1,
              lastUpdated: timestamp,
            });
          } else {
            topicUpdates.set(topicId, {
              ...existing,
              count: existing.count + 1,
            });
          }
        });
      });

      return {
        ...state,
        notes: [...state.notes, ...action.payload],
        companies: state.companies.map(company => {
          const update = companyUpdates.get(company.id);
          return update
            ? {
                ...company,
                noteCount: company.noteCount + update.count,
                lastUpdated: update.lastUpdated,
              }
            : company;
        }),
        contacts: state.contacts.map(contact => {
          const update = contactUpdates.get(contact.id);
          return update
            ? {
                ...contact,
                noteCount: contact.noteCount + update.count,
                lastUpdated: update.lastUpdated,
              }
            : contact;
        }),
        topics: state.topics.map(topic => {
          const update = topicUpdates.get(topic.id);
          return update
            ? {
                ...topic,
                noteCount: topic.noteCount + update.count,
                lastUpdated: update.lastUpdated,
              }
            : topic;
        }),
      };
    }

    // Task actions
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

    // Manual Creation - Topics
    case 'CREATE_MANUAL_TOPIC': {
      const topicData = action.payload;
      const timestamp = new Date().toISOString();
      const id = generateId();

      // Create appropriate entity based on type
      if (topicData.type === 'company') {
        const newCompany: Company = {
          id,
          name: topicData.name,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
          profile: {},
        };
        return { ...state, companies: [...state.companies, newCompany] };
      } else if (topicData.type === 'person') {
        const newContact: Contact = {
          id,
          name: topicData.name,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
          profile: {},
        };
        return { ...state, contacts: [...state.contacts, newContact] };
      } else {
        const newTopic: Topic = {
          id,
          name: topicData.name,
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
        };
        return { ...state, topics: [...state.topics, newTopic] };
      }
    }

    // Manual Creation - Notes
    case 'CREATE_MANUAL_NOTE': {
      const noteData = action.payload;

      // Create entity if needed
      let topicId = noteData.topicId;
      let updatedState = { ...state };

      if (!topicId && noteData.newTopicName) {
        const newId = generateId();
        const timestamp = new Date().toISOString();
        const entityType = noteData.newTopicType || 'other';

        if (entityType === 'company') {
          const newCompany: Company = {
            id: newId,
            name: noteData.newTopicName,
            createdAt: timestamp,
            lastUpdated: timestamp,
            noteCount: 0,
            profile: {},
          };
          updatedState.companies = [...state.companies, newCompany];
          topicId = newId;
        } else if (entityType === 'person') {
          const newContact: Contact = {
            id: newId,
            name: noteData.newTopicName,
            createdAt: timestamp,
            lastUpdated: timestamp,
            noteCount: 0,
            profile: {},
          };
          updatedState.contacts = [...state.contacts, newContact];
          topicId = newId;
        } else {
          const newTopic: Topic = {
            id: newId,
            name: noteData.newTopicName,
            createdAt: timestamp,
            lastUpdated: timestamp,
            noteCount: 0,
          };
          updatedState.topics = [...state.topics, newTopic];
          topicId = newId;
        }
      }

      if (!topicId) {
        // If still no topic, create a default one
        const defaultId = generateId();
        const timestamp = new Date().toISOString();
        const defaultTopic: Topic = {
          id: defaultId,
          name: 'Uncategorized',
          createdAt: timestamp,
          lastUpdated: timestamp,
          noteCount: 0,
        };
        updatedState.topics = [...updatedState.topics, defaultTopic];
        topicId = defaultId;
      }

      const newNote: Note = {
        id: generateId(),
        topicId: topicId!,
        content: noteData.content,
        summary: noteData.content.substring(0, 100) + (noteData.content.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        source: noteData.source || 'thought',
        tags: noteData.tags || [],
      };

      // Update noteCount on the appropriate entity (company, contact, or topic)
      const finalState = {
        ...updatedState,
        notes: [...updatedState.notes, newNote],
        companies: updatedState.companies.map(company =>
          company.id === topicId
            ? { ...company, noteCount: company.noteCount + 1, lastUpdated: newNote.timestamp }
            : company
        ),
        contacts: updatedState.contacts.map(contact =>
          contact.id === topicId
            ? { ...contact, noteCount: contact.noteCount + 1, lastUpdated: newNote.timestamp }
            : contact
        ),
        topics: updatedState.topics.map(topic =>
          topic.id === topicId
            ? { ...topic, noteCount: topic.noteCount + 1, lastUpdated: newNote.timestamp }
            : topic
        ),
      };

      return finalState;
    }

    // UI State - Navigation
    case 'SET_ACTIVE_TAB':
      return { ...state, ui: { ...state.ui, activeTab: action.payload } };

    case 'SET_ZONE':
      return { ...state, currentZone: action.payload, ui: { ...state.ui, activeTab: action.payload as TabType } };

    case 'SET_ACTIVE_TOPIC':
      return { ...state, activeTopicId: action.payload };

    case 'SET_ACTIVE_NOTE':
      return { ...state, activeNoteId: action.payload };

    // UI State - Reference Panel
    case 'TOGGLE_REFERENCE_PANEL':
      return {
        ...state,
        ui: { ...state.ui, referencePanelOpen: !state.ui.referencePanelOpen },
      };

    case 'PIN_NOTE': {
      const noteId = action.payload;
      if (state.ui.pinnedNotes.includes(noteId)) return state;
      if (state.ui.pinnedNotes.length >= 5) {
        // Max 5 pinned notes, remove oldest
        return {
          ...state,
          ui: {
            ...state.ui,
            pinnedNotes: [...state.ui.pinnedNotes.slice(1), noteId],
          },
        };
      }
      return {
        ...state,
        ui: {
          ...state.ui,
          pinnedNotes: [...state.ui.pinnedNotes, noteId],
          referencePanelOpen: true, // Auto-open panel when pinning
        },
      };
    }

    case 'UNPIN_NOTE':
      return {
        ...state,
        ui: {
          ...state.ui,
          pinnedNotes: state.ui.pinnedNotes.filter(id => id !== action.payload),
        },
      };

    case 'CLEAR_PINNED_NOTES':
      return {
        ...state,
        ui: { ...state.ui, pinnedNotes: [], referencePanelOpen: false },
      };

    // UI State - Notifications
    case 'ADD_NOTIFICATION': {
      const notification: Notification = {
        ...action.payload,
        id: generateId(),
        createdAt: new Date().toISOString(),
        read: false,
      };
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [...state.ui.notifications, notification],
        },
      };
    }

    case 'DISMISS_NOTIFICATION':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(n => n.id !== action.payload),
        },
      };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.map(n =>
            n.id === action.payload ? { ...n, read: true } : n
          ),
        },
      };

    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        ui: { ...state.ui, notifications: [] },
      };

    // UI State - Background Processing
    case 'ADD_PROCESSING_JOB': {
      const job: ProcessingJob = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        ...action.payload,
        // Payload can override defaults if id/createdAt provided
      };
      return {
        ...state,
        ui: {
          ...state.ui,
          backgroundProcessing: {
            active: true,
            queue: [...state.ui.backgroundProcessing.queue, job],
            completed: state.ui.backgroundProcessing.completed,
          },
        },
      };
    }

    case 'UPDATE_PROCESSING_JOB':
      return {
        ...state,
        ui: {
          ...state.ui,
          backgroundProcessing: {
            ...state.ui.backgroundProcessing,
            queue: state.ui.backgroundProcessing.queue.map(job =>
              job.id === action.payload.id ? { ...job, ...action.payload.updates } : job
            ),
          },
        },
      };

    case 'COMPLETE_PROCESSING_JOB': {
      const { id, result } = action.payload;
      const job = state.ui.backgroundProcessing.queue.find(j => j.id === id);
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
        ui: {
          ...state.ui,
          backgroundProcessing: {
            active: state.ui.backgroundProcessing.queue.length > 1,
            queue: state.ui.backgroundProcessing.queue.filter(j => j.id !== id),
            completed: [...state.ui.backgroundProcessing.completed, completedJob],
          },
        },
      };
    }

    case 'ERROR_PROCESSING_JOB': {
      const { id, error } = action.payload;
      const job = state.ui.backgroundProcessing.queue.find(j => j.id === id);
      if (!job) return state;

      const erroredJob: ProcessingJob = {
        ...job,
        status: 'error',
        error,
        completedAt: new Date().toISOString(),
      };

      return {
        ...state,
        ui: {
          ...state.ui,
          backgroundProcessing: {
            active: state.ui.backgroundProcessing.queue.length > 1,
            queue: state.ui.backgroundProcessing.queue.filter(j => j.id !== id),
            completed: [...state.ui.backgroundProcessing.completed, erroredJob],
          },
        },
      };
    }

    case 'REMOVE_PROCESSING_JOB':
      return {
        ...state,
        ui: {
          ...state.ui,
          backgroundProcessing: {
            ...state.ui.backgroundProcessing,
            queue: state.ui.backgroundProcessing.queue.filter(j => j.id !== action.payload),
            completed: state.ui.backgroundProcessing.completed.filter(j => j.id !== action.payload),
          },
        },
      };

    // UI State - Bulk Operations
    case 'TOGGLE_BULK_SELECTION_MODE':
      return {
        ...state,
        ui: {
          ...state.ui,
          bulkSelectionMode: !state.ui.bulkSelectionMode,
          selectedTasks: !state.ui.bulkSelectionMode ? [] : state.ui.selectedTasks,
        },
      };

    case 'SELECT_TASK': {
      const taskId = action.payload;
      if (state.ui.selectedTasks.includes(taskId)) return state;
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedTasks: [...state.ui.selectedTasks, taskId],
        },
      };
    }

    case 'DESELECT_TASK':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedTasks: state.ui.selectedTasks.filter(id => id !== action.payload),
        },
      };

    case 'SELECT_ALL_TASKS':
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedTasks: action.payload,
        },
      };

    case 'CLEAR_TASK_SELECTION':
      return {
        ...state,
        ui: { ...state.ui, selectedTasks: [] },
      };

    // UI State - Modals
    case 'TOGGLE_QUICK_CAPTURE':
      return {
        ...state,
        ui: { ...state.ui, quickCaptureOpen: !state.ui.quickCaptureOpen },
      };

    case 'TOGGLE_COMMAND_PALETTE':
      return {
        ...state,
        ui: { ...state.ui, showCommandPalette: !state.ui.showCommandPalette },
      };

    // UI State - Onboarding
    case 'COMPLETE_ONBOARDING':
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: {
            ...state.ui.onboarding,
            completed: true,
          },
        },
      };

    case 'RESET_ONBOARDING':
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: defaultOnboardingState,
        },
      };

    case 'DISMISS_TOOLTIP': {
      const tooltipId = action.payload;
      if (state.ui.onboarding.dismissedTooltips.includes(tooltipId)) return state;
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: {
            ...state.ui.onboarding,
            dismissedTooltips: [...state.ui.onboarding.dismissedTooltips, tooltipId],
          },
        },
      };
    }

    case 'MARK_FEATURE_INTRODUCED':
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: {
            ...state.ui.onboarding,
            featureIntroductions: {
              ...state.ui.onboarding.featureIntroductions,
              [action.payload]: true,
            },
          },
        },
      };

    case 'INCREMENT_ONBOARDING_STAT': {
      const statKey = action.payload;
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: {
            ...state.ui.onboarding,
            stats: {
              ...state.ui.onboarding.stats,
              [statKey]: state.ui.onboarding.stats[statKey] + 1,
            },
          },
        },
      };
    }

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
        ui: {
          ...state.ui,
          preferences: { ...state.ui.preferences, ...action.payload },
        },
      };

    // Sidebar actions
    case 'OPEN_SIDEBAR': {
      const { type, itemId, label } = action.payload;
      const newHistory = [
        ...state.sidebar.history,
        { type, itemId, label }
      ].slice(-3); // Keep max 3 items in history

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
      newHistory.pop(); // Remove current item
      const previous = newHistory[newHistory.length - 1];

      if (!previous) {
        // No more history, close sidebar
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

    // Settings
    case 'UPDATE_AI_SETTINGS':
      return {
        ...state,
        aiSettings: { ...state.aiSettings, ...action.payload },
      };

    case 'UPDATE_LEARNING_SETTINGS':
      return {
        ...state,
        learningSettings: { ...state.learningSettings, ...action.payload },
      };

    case 'UPDATE_USER_PROFILE':
      return {
        ...state,
        userProfile: { ...state.userProfile, ...action.payload },
      };

    case 'UPDATE_NED_SETTINGS':
      return {
        ...state,
        nedSettings: { ...state.nedSettings, ...action.payload },
      };

    case 'GRANT_NED_PERMISSION': {
      const { toolName, level } = action.payload;
      const permission = {
        toolName,
        level,
        grantedAt: new Date().toISOString(),
      };

      if (level === 'session') {
        // Add to session permissions
        return {
          ...state,
          nedSettings: {
            ...state.nedSettings,
            sessionPermissions: [
              ...state.nedSettings.sessionPermissions.filter(p => p.toolName !== toolName),
              permission,
            ],
          },
        };
      } else {
        // Add to permanent permissions
        return {
          ...state,
          nedSettings: {
            ...state.nedSettings,
            permissions: [
              ...state.nedSettings.permissions.filter(p => p.toolName !== toolName),
              permission,
            ],
          },
        };
      }
    }

    case 'REVOKE_NED_PERMISSION':
      return {
        ...state,
        nedSettings: {
          ...state.nedSettings,
          permissions: state.nedSettings.permissions.filter(p => p.toolName !== action.payload),
          sessionPermissions: state.nedSettings.sessionPermissions.filter(p => p.toolName !== action.payload),
        },
      };

    case 'CLEAR_SESSION_PERMISSIONS':
      return {
        ...state,
        nedSettings: {
          ...state.nedSettings,
          sessionPermissions: [],
        },
      };

    // Ned Conversation actions
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

    // Data management
    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  /**
   * STORAGE STRATEGY
   *
   * Current: localStorage (browser-native, ~5-10MB, client-side only)
   * - Pros: Zero setup, no CORS, works offline, completely private
   * - Cons: Single device, limited storage, can be cleared by browser
   *
   * Future considerations:
   * 1. IndexedDB: For larger storage (100s of MB) without CORS issues
   * 2. Cloud sync: Optional multi-device sync via Supabase/Firebase
   * 3. Hybrid: localStorage + periodic cloud backup
   *
   * Current approach is ideal for:
   * - Personal use on a single device
   * - Privacy-first (all data stays local)
   * - Offline-first operation
   *
   * Export/Import JSON (already implemented in Settings) provides manual backup.
   */

  /**
   * MIGRATION: Convert old topics with type field to new Company/Contact/Topic structure
   *
   * Old structure: Topic had a 'type' field ('company', 'person', 'other')
   * New structure:
   *   - Company (for 'company' type topics)
   *   - Contact (for 'person' type topics)
   *   - Topic (for 'other' type topics, no type field)
   *
   * This function also updates notes to use the new multiple relationship arrays
   */
  const migrateTopicsToEntities = (state: any): any => {
    // Check if we need to migrate (look for topics with type field)
    const topicsWithType = state.topics?.filter((t: any) => t.type) || [];

    if (topicsWithType.length === 0) {
      // No migration needed
      return state;
    }

    console.log('🔄 Migrating topics to Company/Contact/Topic structure...', {
      topicsToMigrate: topicsWithType.length,
    });

    const companies: Company[] = state.companies || [];
    const contacts: Contact[] = state.contacts || [];
    const topics: Topic[] = [];
    const idMappings = new Map<string, { newId: string; entityType: 'company' | 'contact' | 'topic' }>();

    // Convert each old topic to appropriate entity type
    topicsWithType.forEach((oldTopic: any) => {
      const baseEntity = {
        id: oldTopic.id, // Keep same ID for easier migration
        name: oldTopic.name,
        createdAt: oldTopic.createdAt,
        lastUpdated: oldTopic.lastUpdated,
        noteCount: oldTopic.noteCount,
      };

      if (oldTopic.type === 'company') {
        companies.push({
          ...baseEntity,
          profile: {},
        });
        idMappings.set(oldTopic.id, { newId: oldTopic.id, entityType: 'company' });
      } else if (oldTopic.type === 'person') {
        contacts.push({
          ...baseEntity,
          profile: {},
        });
        idMappings.set(oldTopic.id, { newId: oldTopic.id, entityType: 'contact' });
      } else {
        // type === 'other' or any other value
        topics.push(baseEntity);
        idMappings.set(oldTopic.id, { newId: oldTopic.id, entityType: 'topic' });
      }
    });

    // Update all notes to use new relationship arrays
    const migratedNotes = (state.notes || []).map((note: any) => {
      const companyIds: string[] = [];
      const contactIds: string[] = [];
      const topicIds: string[] = [];

      // Convert legacy topicId to appropriate array
      if (note.topicId) {
        const mapping = idMappings.get(note.topicId);
        if (mapping) {
          if (mapping.entityType === 'company') {
            companyIds.push(mapping.newId);
          } else if (mapping.entityType === 'contact') {
            contactIds.push(mapping.newId);
          } else {
            topicIds.push(mapping.newId);
          }
        }
      }

      return {
        ...note,
        companyIds: companyIds.length > 0 ? companyIds : undefined,
        contactIds: contactIds.length > 0 ? contactIds : undefined,
        topicIds: topicIds.length > 0 ? topicIds : undefined,
        // Keep legacy topicId for backwards compatibility during transition
        topicId: note.topicId,
      };
    });

    console.log('✅ Migration complete:', {
      companies: companies.length,
      contacts: contacts.length,
      topics: topics.length,
      notesUpdated: migratedNotes.length,
    });

    return {
      ...state,
      companies,
      contacts,
      topics,
      notes: migratedNotes,
    };
  };

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('taskerino-v3-state');
    if (savedState) {
      try {
        let parsed = JSON.parse(savedState);
        // Ensure currentZone is valid (defaults to 'capture' if invalid)
        const validZones = ['assistant', 'capture', 'tasks', 'library', 'profile'];
        if (parsed.currentZone && !validZones.includes(parsed.currentZone)) {
          parsed.currentZone = 'capture';
        }
        // Ensure learnings exists (backwards compatibility)
        if (!parsed.learnings) {
          parsed.learnings = defaultLearnings;
        }
        // Ensure learningSettings exists (backwards compatibility)
        if (!parsed.learningSettings) {
          parsed.learningSettings = defaultLearningSettings;
        }
        // Ensure nedSettings exists (backwards compatibility)
        if (!parsed.nedSettings) {
          parsed.nedSettings = defaultNedSettings;
        }
        // Ensure UI state exists (backwards compatibility)
        if (!parsed.ui) {
          parsed.ui = defaultUIState;
        } else {
          // Merge with defaults to ensure all properties exist
          parsed.ui = {
            ...defaultUIState,
            ...parsed.ui,
            preferences: {
              ...defaultPreferences,
              ...(parsed.ui.preferences || {}),
            },
            backgroundProcessing: {
              ...defaultUIState.backgroundProcessing,
              ...(parsed.ui.backgroundProcessing || {}),
            },
            onboarding: {
              ...defaultOnboardingState,
              ...(parsed.ui.onboarding || {}),
            },
          };
        }
        // Ensure searchHistory exists
        if (!parsed.searchHistory) {
          parsed.searchHistory = [];
        }
        // Ensure companies and contacts exist (backwards compatibility)
        if (!parsed.companies) {
          parsed.companies = [];
        }
        if (!parsed.contacts) {
          parsed.contacts = [];
        }

        // Run migration if needed
        parsed = migrateTopicsToEntities(parsed);

        dispatch({ type: 'LOAD_STATE', payload: parsed });
        console.log('✅ Loaded state from localStorage:', {
          companies: parsed.companies?.length || 0,
          contacts: parsed.contacts?.length || 0,
          topics: parsed.topics?.length || 0,
          notes: parsed.notes?.length || 0,
          tasks: parsed.tasks?.length || 0,
          learnings: parsed.learnings?.learnings?.length || 0,
        });
      } catch (error) {
        console.error('❌ Failed to load saved state:', error);
      }
    } else {
      console.log('ℹ️  No saved state found, starting fresh');
    }
    setHasLoaded(true);
  }, []);

  // Save state to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (!hasLoaded) return; // Don't save until we've loaded existing data

    const dataToSave = {
      companies: state.companies,
      contacts: state.contacts,
      topics: state.topics,
      notes: state.notes,
      tasks: state.tasks,
      aiSettings: state.aiSettings,
      learningSettings: state.learningSettings,
      userProfile: state.userProfile,
      learnings: state.learnings,
      searchHistory: state.searchHistory,
      nedSettings: {
        ...state.nedSettings,
        sessionPermissions: [], // Don't persist session permissions
      },
      // Only save preferences, pinned notes, and onboarding from UI state (not transient state like notifications)
      ui: {
        preferences: state.ui.preferences,
        pinnedNotes: state.ui.pinnedNotes,
        onboarding: state.ui.onboarding,
      },
    };

    try {
      localStorage.setItem('taskerino-v3-state', JSON.stringify(dataToSave));
      console.log('💾 Saved state to localStorage:', {
        companies: state.companies.length,
        contacts: state.contacts.length,
        topics: state.topics.length,
        notes: state.notes.length,
        tasks: state.tasks.length,
      });
    } catch (error) {
      console.error('❌ Failed to save state (quota exceeded?):', error);
      // If quota exceeded, could implement cleanup or notify user
    }
  }, [hasLoaded, state.companies, state.contacts, state.topics, state.notes, state.tasks, state.aiSettings, state.learningSettings, state.userProfile, state.learnings, state.searchHistory, state.nedSettings.permissions, state.nedSettings.chattiness, state.nedSettings.showThinking, state.nedSettings.tokenUsage, state.ui.preferences, state.ui.pinnedNotes, state.ui.onboarding]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}