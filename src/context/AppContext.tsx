import React, { createContext, useContext, useReducer, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Topic, Company, Contact, Note, Task, AppState, TabType, Notification, ProcessingJob, SearchHistoryItem, ManualNoteData, ManualTopicData, ManualTaskData, NedMessage, NedMessageContent, Session, SessionScreenshot, SessionAudioSegment, SessionContextItem } from '../types';
import { generateId } from '../utils/helpers';
import { needsMigration, migrateFromLocalStorage, cleanupOldLocalStorage } from '../services/storage/migration';
import { getStorage } from '../services/storage';
import { MigrationDialog } from '../components/MigrationDialog';
import { audioConcatenationService } from '../services/audioConcatenationService';
import { keyMomentsDetectionService } from '../services/keyMomentsDetectionService';

type AppAction =
  // Session actions
  | { type: 'START_SESSION'; payload: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'> }
  | { type: 'END_SESSION'; payload: string }
  | { type: 'PAUSE_SESSION'; payload: string }
  | { type: 'RESUME_SESSION'; payload: string }
  | { type: 'UPDATE_SESSION'; payload: Session }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'ADD_SESSION_SCREENSHOT'; payload: { sessionId: string; screenshot: SessionScreenshot } }
  | { type: 'ADD_SESSION_AUDIO_SEGMENT'; payload: { sessionId: string; audioSegment: SessionAudioSegment } }
  | { type: 'DELETE_AUDIO_SEGMENT_FILE'; payload: { sessionId: string; segmentId: string } }
  | { type: 'UPDATE_SCREENSHOT_ANALYSIS'; payload: { screenshotId: string; analysis: SessionScreenshot['aiAnalysis']; analysisStatus: SessionScreenshot['analysisStatus']; analysisError?: string } }
  | { type: 'ADD_SCREENSHOT_COMMENT'; payload: { screenshotId: string; comment: string } }
  | { type: 'TOGGLE_SCREENSHOT_FLAG'; payload: string }
  | { type: 'SET_ACTIVE_SESSION'; payload: string | undefined }
  | { type: 'ADD_EXTRACTED_TASK_TO_SESSION'; payload: { sessionId: string; taskId: string } }
  | { type: 'ADD_EXTRACTED_NOTE_TO_SESSION'; payload: { sessionId: string; noteId: string } }
  | { type: 'ADD_SESSION_CONTEXT_ITEM'; payload: { sessionId: string; contextItem: SessionContextItem } }
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

  // UI State - Ned Overlay
  | { type: 'TOGGLE_NED_OVERLAY' }
  | { type: 'OPEN_NED_OVERLAY' }
  | { type: 'CLOSE_NED_OVERLAY' }

  // UI State - Review
  | { type: 'SET_PENDING_REVIEW_JOB'; payload: string | undefined }

  // UI State - Onboarding
  | { type: 'COMPLETE_ONBOARDING' }
  | { type: 'RESET_ONBOARDING' }
  | { type: 'DISMISS_TOOLTIP'; payload: string }
  | { type: 'MARK_FEATURE_INTRODUCED'; payload: keyof AppState['ui']['onboarding']['featureIntroductions'] }
  | { type: 'INCREMENT_ONBOARDING_STAT'; payload: keyof AppState['ui']['onboarding']['stats'] }
  | { type: 'SHOW_FEATURE_TOOLTIP'; payload: string }
  | { type: 'INCREMENT_TOOLTIP_STAT'; payload: 'shown' | 'dismissed' }
  | { type: 'COMPLETE_FIRST_CAPTURE' }

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
  zoomLevel: 100,
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
  nedOverlay: {
    isOpen: false,
  },
};

const initialState: AppState = {
  companies: [],
  contacts: [],
  topics: [],
  notes: [],
  tasks: [],
  sessions: [],
  activeSessionId: undefined,
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
    // Session actions
    case 'START_SESSION': {
      const newSession: Session = {
        ...action.payload,
        id: generateId(),
        startTime: new Date().toISOString(),
        screenshots: [],
        extractedTaskIds: [],
        extractedNoteIds: [],
        status: 'active',
      };
      return {
        ...state,
        sessions: [...state.sessions, newSession],
        activeSessionId: newSession.id,
      };
    }

    case 'END_SESSION': {
      const sessionId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => {
          if (session.id !== sessionId) return session;

          const endTime = new Date().toISOString();
          let totalDuration: number | undefined;

          if (session.startTime) {
            const startMs = new Date(session.startTime).getTime();
            const endMs = new Date(endTime).getTime();
            let totalPausedMs = session.totalPausedTime || 0;

            // If currently paused, add current pause duration
            if (session.status === 'paused' && session.pausedAt) {
              const currentPauseDuration = endMs - new Date(session.pausedAt).getTime();
              totalPausedMs += currentPauseDuration;
            }

            // Calculate duration: (end - start - total paused time) in minutes
            const activeMs = endMs - startMs - totalPausedMs;
            totalDuration = Math.floor(activeMs / 60000);
          }

          return {
            ...session,
            status: 'completed',
            endTime,
            totalDuration,
            pausedAt: undefined, // Clear pause timestamp
          };
        }),
        activeSessionId: state.activeSessionId === sessionId ? undefined : state.activeSessionId,
      };
    }

    case 'PAUSE_SESSION': {
      const sessionId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                status: 'paused',
                pausedAt: new Date().toISOString(),
              }
            : session
        ),
      };
    }

    case 'RESUME_SESSION': {
      const sessionId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => {
          if (session.id !== sessionId) return session;

          // Calculate pause duration if session was paused
          let additionalPausedTime = 0;
          if (session.pausedAt) {
            const pauseStart = new Date(session.pausedAt).getTime();
            const pauseEnd = new Date().getTime();
            additionalPausedTime = pauseEnd - pauseStart;
          }

          return {
            ...session,
            status: 'active',
            pausedAt: undefined, // Clear pause timestamp
            totalPausedTime: (session.totalPausedTime || 0) + additionalPausedTime,
          };
        }),
        activeSessionId: sessionId,
      };
    }

    case 'UPDATE_SESSION': {
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === action.payload.id ? { ...session, ...action.payload } : session
        ),
      };
    }

    case 'DELETE_SESSION': {
      // Clear session-specific caches when deleting a session
      audioConcatenationService.clearCache(action.payload);
      keyMomentsDetectionService.clearCache(action.payload);

      return {
        ...state,
        sessions: state.sessions.filter(session => session.id !== action.payload),
        activeSessionId: state.activeSessionId === action.payload ? undefined : state.activeSessionId,
      };
    }

    case 'ADD_SESSION_SCREENSHOT': {
      const { sessionId, screenshot } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                screenshots: [...session.screenshots, screenshot],
                lastScreenshotTime: screenshot.timestamp,
              }
            : session
        ),
      };
    }

    case 'ADD_SESSION_AUDIO_SEGMENT': {
      const { sessionId, audioSegment } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                audioSegments: [...(session.audioSegments || []), audioSegment],
              }
            : session
        ),
      };
    }

    case 'DELETE_AUDIO_SEGMENT_FILE': {
      const { sessionId, segmentId } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                audioSegments: (session.audioSegments || []).map(segment =>
                  segment.id === segmentId
                    ? { ...segment, filePath: undefined }
                    : segment
                ),
              }
            : session
        ),
      };
    }

    case 'UPDATE_SCREENSHOT_ANALYSIS': {
      const { screenshotId, analysis, analysisStatus, analysisError } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => ({
          ...session,
          screenshots: (session.screenshots || []).map(screenshot =>
            screenshot.id === screenshotId
              ? {
                  ...screenshot,
                  aiAnalysis: analysis,
                  analysisStatus,
                  analysisError,
                }
              : screenshot
          ),
        })),
      };
    }

    case 'ADD_SCREENSHOT_COMMENT': {
      const { screenshotId, comment } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => ({
          ...session,
          screenshots: (session.screenshots || []).map(screenshot =>
            screenshot.id === screenshotId
              ? { ...screenshot, userComment: comment }
              : screenshot
          ),
        })),
      };
    }

    case 'TOGGLE_SCREENSHOT_FLAG': {
      const screenshotId = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session => ({
          ...session,
          screenshots: (session.screenshots || []).map(screenshot =>
            screenshot.id === screenshotId
              ? { ...screenshot, flagged: !screenshot.flagged }
              : screenshot
          ),
        })),
      };
    }

    case 'SET_ACTIVE_SESSION': {
      return {
        ...state,
        activeSessionId: action.payload,
      };
    }

    case 'ADD_EXTRACTED_TASK_TO_SESSION': {
      const { sessionId, taskId } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                extractedTaskIds: [...session.extractedTaskIds, taskId],
              }
            : session
        ),
      };
    }

    case 'ADD_EXTRACTED_NOTE_TO_SESSION': {
      const { sessionId, noteId } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                extractedNoteIds: [...session.extractedNoteIds, noteId],
              }
            : session
        ),
      };
    }

    case 'ADD_SESSION_CONTEXT_ITEM': {
      const { sessionId, contextItem } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.id === sessionId
            ? {
                ...session,
                contextItems: [...(session.contextItems || []), contextItem],
              }
            : session
        ),
      };
    }

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
      const updatedState = { ...state };

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

    // UI State - Ned Overlay
    case 'TOGGLE_NED_OVERLAY':
      return {
        ...state,
        ui: {
          ...state.ui,
          nedOverlay: {
            isOpen: !state.ui.nedOverlay.isOpen,
          },
        },
      };

    case 'OPEN_NED_OVERLAY':
      return {
        ...state,
        ui: {
          ...state.ui,
          nedOverlay: {
            isOpen: true,
          },
        },
      };

    case 'CLOSE_NED_OVERLAY':
      return {
        ...state,
        ui: {
          ...state.ui,
          nedOverlay: {
            isOpen: false,
          },
        },
      };

    // UI State - Review
    case 'SET_PENDING_REVIEW_JOB':
      return {
        ...state,
        ui: { ...state.ui, pendingReviewJobId: action.payload },
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
      const currentValue = state.ui.onboarding.stats[statKey];

      // Only increment if the value is a number (not lastActiveDate which is a string)
      if (typeof currentValue === 'number') {
        return {
          ...state,
          ui: {
            ...state.ui,
            onboarding: {
              ...state.ui.onboarding,
              stats: {
                ...state.ui.onboarding.stats,
                [statKey]: currentValue + 1,
              },
            },
          },
        };
      }

      // If it's not a number, return state unchanged
      return state;
    }

    case 'SHOW_FEATURE_TOOLTIP': {
      const tooltipId = action.payload;
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: {
            ...state.ui.onboarding,
            stats: {
              ...state.ui.onboarding.stats,
              tooltipsShown: state.ui.onboarding.stats.tooltipsShown + 1,
            },
          },
        },
      };
    }

    case 'INCREMENT_TOOLTIP_STAT': {
      const statType = action.payload;
      const statKey = statType === 'shown' ? 'tooltipsShown' : 'tooltipsDismissed';
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

    case 'COMPLETE_FIRST_CAPTURE':
      return {
        ...state,
        ui: {
          ...state.ui,
          onboarding: {
            ...state.ui.onboarding,
            firstCaptureCompleted: true,
          },
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
  const [state, baseDispatch] = useReducer(appReducer, initialState);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = React.useState(false);
  const [migrationError, setMigrationError] = React.useState<Error | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);

  // Keep stateRef up to date
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Critical actions that need immediate save
  // CRITICAL: Screenshots and audio must be saved immediately to prevent data loss
  const CRITICAL_ACTIONS = new Set([
    'END_SESSION',
    'DELETE_SESSION',
    'START_SESSION',
    'UPDATE_SESSION',
    'ADD_SESSION_SCREENSHOT',      // CRITICAL: Save screenshots immediately
    'ADD_SESSION_AUDIO_SEGMENT',    // CRITICAL: Save audio segments immediately
    'UPDATE_SCREENSHOT_ANALYSIS',   // CRITICAL: Save AI analysis immediately
    'ADD_SESSION_CONTEXT_ITEM',     // CRITICAL: Save manual notes immediately
  ]);

  /**
   * Custom dispatch wrapper that immediately saves for critical actions
   */
  const dispatch = React.useCallback((action: AppAction) => {
    baseDispatch(action);

    // If critical action, save immediately (after state update)
    if (CRITICAL_ACTIONS.has(action.type)) {
      // Use queueMicrotask + requestAnimationFrame to ensure React finishes all state updates
      queueMicrotask(async () => {
        // Wait for React to flush all pending updates
        await new Promise(resolve => requestAnimationFrame(resolve));

        console.log(`🔴 Critical action ${action.type} - saving immediately`);
        try {
          const storage = await getStorage();
          await storage.save('sessions', stateRef.current.sessions);
          await storage.save('settings', {
            aiSettings: stateRef.current.aiSettings,
            learningSettings: stateRef.current.learningSettings,
            userProfile: stateRef.current.userProfile,
            learnings: stateRef.current.learnings,
            searchHistory: stateRef.current.searchHistory,
            activeSessionId: stateRef.current.activeSessionId,
            nedSettings: { ...stateRef.current.nedSettings, sessionPermissions: [] },
            ui: {
              preferences: stateRef.current.ui.preferences,
              pinnedNotes: stateRef.current.ui.pinnedNotes,
              onboarding: stateRef.current.ui.onboarding,
            },
          });
          console.log('✅ Critical data saved immediately');
        } catch (error) {
          console.error('❌ Failed to save critical data:', error);
          // Fallback to localStorage
          try {
            const dataToSave = {
              sessions: stateRef.current.sessions,
              activeSessionId: stateRef.current.activeSessionId,
              timestamp: Date.now(),
            };
            localStorage.setItem('taskerino-critical-save', JSON.stringify(dataToSave));
            console.warn('⚠️ Critical data saved to localStorage fallback');
          } catch (fallbackError) {
            console.error('❌ Fallback save also failed:', fallbackError);
          }
        }
      });
    }
  }, []);

  /**
   * STORAGE STRATEGY - UPDATED
   *
   * New system:
   * - Desktop (Tauri): File system storage (unlimited)
   * - Web: IndexedDB storage (100s of MB)
   * - localStorage: Only used during migration transition
   *
   * Migration:
   * - Automatically migrates from old localStorage format
   * - Keeps backup for 7 days
   * - Verifies migration success before marking complete
   *
   * Benefits:
   * - Unlimited storage for desktop app
   * - Much larger storage for web (IndexedDB vs localStorage)
   * - Automatic backups
   * - Data integrity verification
   */

  /**
   * MIGRATION: Convert old topics with type field to new Company/Contact/Topic structure
   */
  const migrateTopicsToEntities = (state: any): any => {
    const topicsWithType = state.topics?.filter((t: any) => t.type) || [];

    if (topicsWithType.length === 0) {
      return state;
    }

    console.log('🔄 Migrating topics to Company/Contact/Topic structure...', {
      topicsToMigrate: topicsWithType.length,
    });

    const companies: Company[] = state.companies || [];
    const contacts: Contact[] = state.contacts || [];
    const topics: Topic[] = [];
    const idMappings = new Map<string, { newId: string; entityType: 'company' | 'contact' | 'topic' }>();

    topicsWithType.forEach((oldTopic: any) => {
      const baseEntity = {
        id: oldTopic.id,
        name: oldTopic.name,
        createdAt: oldTopic.createdAt,
        lastUpdated: oldTopic.lastUpdated,
        noteCount: oldTopic.noteCount,
      };

      if (oldTopic.type === 'company') {
        companies.push({ ...baseEntity, profile: {} });
        idMappings.set(oldTopic.id, { newId: oldTopic.id, entityType: 'company' });
      } else if (oldTopic.type === 'person') {
        contacts.push({ ...baseEntity, profile: {} });
        idMappings.set(oldTopic.id, { newId: oldTopic.id, entityType: 'contact' });
      } else {
        topics.push(baseEntity);
        idMappings.set(oldTopic.id, { newId: oldTopic.id, entityType: 'topic' });
      }
    });

    const migratedNotes = (state.notes || []).map((note: any) => {
      const companyIds: string[] = [];
      const contactIds: string[] = [];
      const topicIds: string[] = [];

      if (note.topicId) {
        const mapping = idMappings.get(note.topicId);
        if (mapping) {
          if (mapping.entityType === 'company') companyIds.push(mapping.newId);
          else if (mapping.entityType === 'contact') contactIds.push(mapping.newId);
          else topicIds.push(mapping.newId);
        }
      }

      return {
        ...note,
        companyIds: companyIds.length > 0 ? companyIds : undefined,
        contactIds: contactIds.length > 0 ? contactIds : undefined,
        topicIds: topicIds.length > 0 ? topicIds : undefined,
        topicId: note.topicId,
      };
    });

    console.log('✅ Migration complete:', {
      companies: companies.length,
      contacts: contacts.length,
      topics: topics.length,
      notesUpdated: migratedNotes.length,
    });

    return { ...state, companies, contacts, topics, notes: migratedNotes };
  };

  /**
   * Initialize storage and check for migration
   */
  useEffect(() => {
    async function initializeApp() {
      try {
        console.log('🔄 Initializing app...');

        // Try new storage system first, but always fall back to localStorage
        try {
          const shouldMigrate = await needsMigration();

          if (shouldMigrate) {
            console.log('🔄 Migration needed from localStorage');
            setShowMigrationDialog(true);
            setHasLoaded(true); // FIX: Allow app to load even with migration dialog
            return;
          }

          // Load from new storage system
          await loadFromStorage();

          // Cleanup old localStorage data if migration was completed >7 days ago
          cleanupOldLocalStorage();
        } catch (storageError) {
          console.warn('⚠️  New storage system not available, using localStorage:', storageError);
          await loadFromLocalStorage();
        }
      } catch (error) {
        console.error('❌ Failed to initialize app:', error);
      } finally {
        setHasLoaded(true); // ALWAYS set loaded
      }
    }

    initializeApp();
  }, []);

  /**
   * Save on window/app close - critical safety net
   */
  useEffect(() => {
    const handleBeforeUnload = async () => {
      console.log('🛑 App closing - forcing final save');
      try {
        const storage = await getStorage();
        await storage.save('sessions', stateRef.current.sessions);
        await storage.save('settings', {
          aiSettings: stateRef.current.aiSettings,
          learningSettings: stateRef.current.learningSettings,
          userProfile: stateRef.current.userProfile,
          learnings: stateRef.current.learnings,
          searchHistory: stateRef.current.searchHistory,
          activeSessionId: stateRef.current.activeSessionId,
          nedSettings: { ...stateRef.current.nedSettings, sessionPermissions: [] },
          ui: {
            preferences: stateRef.current.ui.preferences,
            pinnedNotes: stateRef.current.ui.pinnedNotes,
            onboarding: stateRef.current.ui.onboarding,
          },
        });
        console.log('✅ Final save complete');
      } catch (error) {
        console.error('❌ Failed final save:', error);
        // Last ditch attempt: localStorage
        try {
          const dataToSave = {
            sessions: stateRef.current.sessions,
            activeSessionId: stateRef.current.activeSessionId,
          };
          localStorage.setItem('taskerino-emergency-save', JSON.stringify(dataToSave));
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  /**
   * Periodic auto-save for active sessions - limits data loss to 30 seconds in case of crash
   */
  useEffect(() => {
    if (!hasLoaded || !state.activeSessionId) return;

    console.log('⏰ Starting periodic auto-save for active session');

    const interval = setInterval(async () => {
      console.log('⏰ Periodic auto-save for active session');
      try {
        const storage = await getStorage();
        await storage.save('sessions', stateRef.current.sessions);
        console.log('✅ Periodic auto-save complete');
      } catch (error) {
        console.error('❌ Periodic auto-save failed:', error);
      }
    }, 30000); // Every 30 seconds

    return () => {
      console.log('⏰ Stopping periodic auto-save');
      clearInterval(interval);
    };
  }, [hasLoaded, state.activeSessionId]);

  /**
   * Load state from new storage system
   */
  async function loadFromStorage() {
    try {
      const storage = await getStorage();

      const [companies, contacts, topics, notes, tasks, sessions, settings] = await Promise.all([
        storage.load('companies'),
        storage.load('contacts'),
        storage.load('topics'),
        storage.load('notes'),
        storage.load('tasks'),
        storage.load('sessions'),
        storage.load('settings')
      ]);

      const loadedState: Partial<AppState> = {
        companies: Array.isArray(companies) ? companies : [],
        contacts: Array.isArray(contacts) ? contacts : [],
        topics: Array.isArray(topics) ? topics : [],
        notes: Array.isArray(notes) ? notes : [],
        tasks: Array.isArray(tasks) ? tasks : [],
        sessions: Array.isArray(sessions) ? sessions : [],
      };

      if (settings && typeof settings === 'object') {
        const settingsObj = settings as any;
        loadedState.aiSettings = settingsObj.aiSettings || defaultAISettings;
        loadedState.learningSettings = settingsObj.learningSettings || defaultLearningSettings;
        loadedState.userProfile = settingsObj.userProfile || defaultUserProfile;
        loadedState.learnings = settingsObj.learnings || defaultLearnings;
        loadedState.nedSettings = settingsObj.nedSettings || defaultNedSettings;
        loadedState.searchHistory = Array.isArray(settingsObj.searchHistory) ? settingsObj.searchHistory : [];
        loadedState.activeSessionId = settingsObj.activeSessionId;

        if (settingsObj.ui && typeof settingsObj.ui === 'object') {
          loadedState.ui = {
            ...defaultUIState,
            ...settingsObj.ui,
            preferences: { ...defaultPreferences, ...(settingsObj.ui.preferences || {}) },
            onboarding: { ...defaultOnboardingState, ...(settingsObj.ui.onboarding || {}) },
          };
        }
      }

      const migratedState = migrateTopicsToEntities(loadedState);
      dispatch({ type: 'LOAD_STATE', payload: migratedState });

      console.log('✅ Loaded state from new storage system:', {
        companies: loadedState.companies?.length || 0,
        contacts: loadedState.contacts?.length || 0,
        topics: loadedState.topics?.length || 0,
        notes: loadedState.notes?.length || 0,
        tasks: loadedState.tasks?.length || 0,
        sessions: loadedState.sessions?.length || 0,
      });

      setHasLoaded(true);
    } catch (error) {
      console.error('❌ Failed to load from storage:', error);
      throw error;
    }
  }

  /**
   * Fallback: Load from localStorage (legacy)
   */
  async function loadFromLocalStorage() {
    const savedState = localStorage.getItem('taskerino-v3-state');

    if (!savedState) {
      console.log('ℹ️  No saved state found, starting fresh');
      setHasLoaded(true);
      return;
    }

    try {
      let parsed = JSON.parse(savedState);

      if (parsed.sessions && JSON.stringify(parsed.sessions).length > 5 * 1024 * 1024) {
        console.warn('⚠️  Sessions data is very large (>5MB), clearing to prevent errors');
        parsed.sessions = [];
        parsed.activeSessionId = undefined;
      }

      const validZones = ['assistant', 'capture', 'tasks', 'notes', 'profile'];
      if (parsed.currentZone && !validZones.includes(parsed.currentZone)) {
        parsed.currentZone = 'capture';
      }

      parsed.learnings = parsed.learnings || defaultLearnings;
      parsed.learningSettings = parsed.learningSettings || defaultLearningSettings;
      parsed.nedSettings = parsed.nedSettings || defaultNedSettings;
      parsed.searchHistory = parsed.searchHistory || [];
      parsed.companies = parsed.companies || [];
      parsed.contacts = parsed.contacts || [];
      parsed.sessions = parsed.sessions || [];
      parsed.topics = parsed.topics || [];

      if (!parsed.ui) {
        parsed.ui = defaultUIState;
      } else {
        parsed.ui = {
          ...defaultUIState,
          ...parsed.ui,
          preferences: { ...defaultPreferences, ...(parsed.ui.preferences || {}) },
          backgroundProcessing: { ...defaultUIState.backgroundProcessing, ...(parsed.ui.backgroundProcessing || {}) },
          onboarding: { ...defaultOnboardingState, ...(parsed.ui.onboarding || {}) },
        };
      }

      parsed = migrateTopicsToEntities(parsed);
      dispatch({ type: 'LOAD_STATE', payload: parsed });

      console.log('✅ Loaded state from localStorage (fallback):', {
        companies: parsed.companies?.length || 0,
        contacts: parsed.contacts?.length || 0,
        topics: parsed.topics?.length || 0,
        notes: parsed.notes?.length || 0,
        tasks: parsed.tasks?.length || 0,
        sessions: parsed.sessions?.length || 0,
      });

      setHasLoaded(true);
    } catch (error) {
      console.error('❌ Failed to load saved state:', error);
      console.warn('⚠️  Clearing corrupted localStorage and starting fresh');
      localStorage.removeItem('taskerino-v3-state');
      setHasLoaded(true);
    }
  }

  /**
   * Save state to new storage system (debounced)
   */
  useEffect(() => {
    if (!hasLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveToStorage();
      } catch (error) {
        console.error('❌ Failed to save state:', error);
        try {
          saveToLocalStorage();
        } catch (fallbackError) {
          console.error('❌ Fallback save also failed:', fallbackError);
        }
      }
    }, 5000); // Increased from 2s to 5s for better performance

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasLoaded, state.companies, state.contacts, state.topics, state.notes, state.tasks, state.sessions, state.activeSessionId, state.aiSettings, state.learningSettings, state.userProfile, state.learnings, state.searchHistory, state.nedSettings, state.ui.preferences, state.ui.pinnedNotes, state.ui.onboarding]);

  /**
   * Save to new storage system
   */
  async function saveToStorage() {
    try {
      const storage = await getStorage();

      const settings = {
        aiSettings: state.aiSettings,
        learningSettings: state.learningSettings,
        userProfile: state.userProfile,
        learnings: state.learnings,
        searchHistory: state.searchHistory,
        activeSessionId: state.activeSessionId,
        nedSettings: { ...state.nedSettings, sessionPermissions: [] },
        ui: {
          preferences: state.ui.preferences,
          pinnedNotes: state.ui.pinnedNotes,
          onboarding: state.ui.onboarding,
        },
      };

      await Promise.all([
        storage.save('companies', state.companies),
        storage.save('contacts', state.contacts),
        storage.save('topics', state.topics),
        storage.save('notes', state.notes),
        storage.save('tasks', state.tasks),
        storage.save('sessions', state.sessions),
        storage.save('settings', settings),
      ]);

      console.log('💾 Saved state to storage:', {
        companies: state.companies.length,
        contacts: state.contacts.length,
        topics: state.topics.length,
        notes: state.notes.length,
        tasks: state.tasks.length,
        sessions: state.sessions.length,
      });
    } catch (error) {
      console.error('❌ Failed to save to storage:', error);
      throw error;
    }
  }

  /**
   * Fallback: Save to localStorage (legacy)
   */
  function saveToLocalStorage() {
    const cleanSessions = state.sessions.map(session => ({
      ...session,
      screenshots: session.screenshots.map(screenshot => {
        const cleanScreenshot: any = { ...screenshot };
        delete cleanScreenshot.attachmentData;
        return cleanScreenshot as SessionScreenshot;
      }),
    }));

    const dataToSave = {
      companies: state.companies,
      contacts: state.contacts,
      topics: state.topics,
      notes: state.notes,
      tasks: state.tasks,
      sessions: cleanSessions,
      activeSessionId: state.activeSessionId,
      aiSettings: state.aiSettings,
      learningSettings: state.learningSettings,
      userProfile: state.userProfile,
      learnings: state.learnings,
      searchHistory: state.searchHistory,
      nedSettings: { ...state.nedSettings, sessionPermissions: [] },
      ui: {
        preferences: state.ui.preferences,
        pinnedNotes: state.ui.pinnedNotes,
        onboarding: state.ui.onboarding,
      },
    };

    try {
      localStorage.setItem('taskerino-v3-state', JSON.stringify(dataToSave));
      console.log('💾 Saved state to localStorage (fallback)');
    } catch (error) {
      console.error('❌ Failed to save state to localStorage:', error);
      try {
        const reducedDataToSave = { ...dataToSave, sessions: [], activeSessionId: undefined };
        localStorage.setItem('taskerino-v3-state', JSON.stringify(reducedDataToSave));
        console.warn('⚠️  Saved state without sessions due to storage quota');
      } catch (fallbackError) {
        console.error('❌ Failed to save even without sessions:', fallbackError);
      }
    }
  }

  /**
   * Handle migration completion
   */
  function handleMigrationComplete() {
    setShowMigrationDialog(false);
    setMigrationError(null);
    loadFromStorage();
  }

  /**
   * Handle migration error
   */
  function handleMigrationError(error: Error) {
    console.error('Migration error:', error);
    setMigrationError(error);
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {showMigrationDialog && (
        <MigrationDialog
          onComplete={handleMigrationComplete}
          onError={handleMigrationError}
        />
      )}
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