/**
 * Ned Chat Interface
 *
 * Main chat component for Ned AI assistant.
 * Handles conversation flow, streaming, tool execution, and permissions.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { Send, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';
import { useNotes } from '../../context/NotesContext';
import { useTasks } from '../../context/TasksContext';
import { useSessionList } from '../../context/SessionListContext';
import { useEntities } from '../../context/EntitiesContext';
import { nedService } from '../../services/nedService';
import { contextAgent } from '../../services/contextAgent';
import { sessionsQueryAgent } from '../../services/sessionsQueryAgent';
import { NedToolExecutor } from '../../services/nedToolExecutor';
import { NedMessage } from './NedMessage';
import { PermissionDialog } from './PermissionDialog';
import { TOOL_DESCRIPTIONS } from '../../services/nedTools';
import { FeatureTooltip } from '../FeatureTooltip';
import { CHAT_STYLES } from '../../design-system/theme';
import type { Task, Note } from '../../types';

const CONVERSATION_ID = 'main'; // For now, single conversation

interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

interface MessageContent {
  type: 'text' | 'task-list' | 'note-list' | 'session-list' | 'task-update' | 'note-update' | 'task-created' | 'note-created' | 'tool-use' | 'tool-result' | 'error' | 'thinking';
  content?: string;
  tasks?: Task[];
  notes?: Note[];
  sessions?: any[]; // Session type
  // For updates
  taskId?: string;
  noteId?: string;
  taskTitle?: string;
  noteSummary?: string;
  changes?: FieldChange[];
  timestamp?: string;
  // For created items
  task?: Task;
  note?: Note;
  // Tool use
  toolName?: string;
  toolStatus?: 'pending' | 'success' | 'error';
}

interface NedMessageData {
  id: string;
  role: 'user' | 'assistant';
  contents: MessageContent[];
  timestamp: string;
}

interface ToolPermissionRequest {
  toolName: string;
  toolDescription: string;
  context?: string;
  resolve: (granted: boolean, level?: 'forever' | 'session' | 'always-ask') => void;
}

export const NedChat: React.FC = () => {
  const { state: settingsState, dispatch: settingsDispatch } = useSettings();
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { state: notesState } = useNotes();
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { sessions } = useSessionList();
  const { state: entitiesState } = useEntities();

  const messages = uiState.nedConversation?.messages || [];
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('Thinking...');
  const [error, setError] = useState<string | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<ToolPermissionRequest | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showNedWelcome, setShowNedWelcome] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check if API key exists on mount (using Tauri backend)
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const exists = await invoke<boolean>('has_claude_api_key');
        setHasApiKey(exists);
      } catch (error) {
        console.error('[NedChat] Failed to check API key:', error);
        setHasApiKey(false);
      }
    };
    checkApiKey();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Show welcome tooltip on first open when no queries made yet
  useEffect(() => {
    if (
      !uiState.onboarding.featureIntroductions.nedAssistant &&
      uiState.onboarding.stats.nedQueryCount === 0 &&
      hasApiKey &&
      !showNedWelcome
    ) {
      setShowNedWelcome(true);
    }
  }, [uiState.onboarding.featureIntroductions.nedAssistant, uiState.onboarding.stats.nedQueryCount, hasApiKey, showNedWelcome]);

  // Permission checker function
  const checkPermission = useCallback(async (toolName: string, context?: string): Promise<boolean> => {
    // Check if permission already granted
    const allPermissions = [...settingsState.nedSettings.permissions, ...settingsState.nedSettings.sessionPermissions];
    const existingPermission = allPermissions.find(p => p.toolName === toolName);

    if (existingPermission) {
      if (existingPermission.level === 'forever' || existingPermission.level === 'session') {
        return true;
      }
      // If 'always-ask', fall through to request
    }

    // Request permission
    return new Promise((resolve) => {
      setPermissionRequest({
        toolName,
        toolDescription: TOOL_DESCRIPTIONS[toolName] || toolName,
        context,
        resolve: (granted, level) => {
          if (granted && level) {
            settingsDispatch({
              type: 'GRANT_NED_PERMISSION',
              payload: { toolName, level },
            });
          }
          resolve(granted);
        },
      });
    });
  }, [settingsState.nedSettings, settingsDispatch]);

  // Handle permission dialog response
  const handlePermissionGrant = (level: 'forever' | 'session' | 'always-ask') => {
    if (permissionRequest) {
      permissionRequest.resolve(true, level);
      setPermissionRequest(null);
    }
  };

  const handlePermissionDeny = () => {
    if (permissionRequest) {
      permissionRequest.resolve(false);
      setPermissionRequest(null);
    }
  };

  // Tool executor - needs to reconstruct state object for backward compatibility
  const createToolExecutor = useCallback(() => {
    // Reconstruct a state object that matches the old AppState structure
    const reconstructedState = {
      tasks: tasksState.tasks,
      notes: notesState.notes,
      sessions: sessions,
      companies: entitiesState.companies,
      contacts: entitiesState.contacts,
      topics: entitiesState.topics,
      ui: uiState,
      sidebar: uiState.sidebar,
      aiSettings: settingsState.aiSettings,
      learningSettings: settingsState.learningSettings,
      userProfile: settingsState.userProfile,
      learnings: settingsState.learnings,
      nedSettings: settingsState.nedSettings,
      activeSessionId: null, // TODO: get from useActiveSession() hook (Phase 1)
      nedConversation: uiState.nedConversation,
    } as any;

    // Create a dispatch function that routes to the correct context
    const combinedDispatch = (action: any) => {
      // Route action to correct context based on type
      if (action.type.startsWith('ADD_TASK') || action.type.startsWith('UPDATE_TASK') || action.type.startsWith('DELETE_TASK') || action.type.startsWith('TOGGLE_TASK') || action.type.startsWith('BATCH_') && action.type.includes('TASK')) {
        tasksDispatch(action);
      } else if (action.type.startsWith('ADD_NOTE') || action.type.startsWith('UPDATE_NOTE') || action.type.startsWith('DELETE_NOTE')) {
        // Note: useNotes hook would need to expose dispatch, but for now NedToolExecutor should use methods
        console.warn('[NedChat] Note dispatch called, but should use useNotes methods instead');
      } else if (action.type.startsWith('SET_ACTIVE_TAB') || action.type.startsWith('OPEN_SIDEBAR') || action.type.includes('_NED_')) {
        uiDispatch(action);
      } else if (action.type.includes('NED_PERMISSION') || action.type.includes('_SETTINGS')) {
        settingsDispatch(action);
      } else {
        console.warn('[NedChat] Unknown action type for routing:', action.type);
      }
    };

    return new NedToolExecutor(reconstructedState, combinedDispatch);
  }, [tasksState, notesState, sessions, entitiesState, uiState, settingsState, tasksDispatch, uiDispatch, settingsDispatch]);

  // Send message
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setIsProcessing(true);

    // Track Ned query stat
    uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'nedQueryCount' });

    // Add user message
    const userMsg: NedMessageData = {
      id: `msg_${Date.now()}`,
      role: 'user',
      contents: [{ type: 'text', content: userMessage }],
      timestamp: new Date().toISOString(),
    };
    uiDispatch({ type: 'ADD_NED_MESSAGE', payload: userMsg });

    // Prepare assistant message
    const assistantMsg: NedMessageData = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      contents: [],
      timestamp: new Date().toISOString(),
    };
    uiDispatch({ type: 'ADD_NED_MESSAGE', payload: assistantMsg });

    // Track contents locally during streaming
    let streamingContents: MessageContent[] = [];

    try {
      const toolExecutor = createToolExecutor();

      console.log('[NedChat] Sending message:', userMessage);

      // Reconstruct state for nedService (same as createToolExecutor)
      const reconstructedState = {
        tasks: tasksState.tasks,
        notes: notesState.notes,
        sessions: sessions,
        companies: entitiesState.companies,
        contacts: entitiesState.contacts,
        topics: entitiesState.topics,
        ui: uiState,
        sidebar: uiState.sidebar,
        aiSettings: settingsState.aiSettings,
        learningSettings: settingsState.learningSettings,
        userProfile: settingsState.userProfile,
        learnings: settingsState.learnings,
        nedSettings: settingsState.nedSettings,
        activeSessionId: null,
        nedConversation: uiState.nedConversation,
      } as any;

      // Stream response
      for await (const chunk of nedService.sendMessage(
        CONVERSATION_ID,
        userMessage,
        reconstructedState,
        async (toolCall) => {
          console.log('[NedChat] Executing tool:', toolCall.name, toolCall.input);
          // Execute tool
          const result = await toolExecutor.execute(toolCall);
          console.log('[NedChat] Tool result:', result);

          // Update token usage
          // TODO: Track actual token usage from API response

          return result;
        },
        async (toolName: string) => {
          console.log('[NedChat] Checking permission for:', toolName);
          // Check permission
          return await checkPermission(toolName);
        }
      )) {
        console.log('[NedChat] Received chunk:', chunk);

        // Update processing status based on chunk type
        if (chunk.type === 'thinking') {
          setProcessingStatus('Thinking...');
        } else if (chunk.type === 'tool-use') {
          // Map tool names to friendly status messages
          const statusMessages: Record<string, string> = {
            'query_context_agent': 'Searching your notes...',
            'get_current_datetime': 'Getting current time...',
            'create_task': 'Creating task...',
            'update_task': 'Updating task...',
            'delete_task': 'Deleting task...',
            'create_note': 'Creating note...',
            'update_note': 'Updating note...',
            'delete_note': 'Deleting note...',
          };
          setProcessingStatus(statusMessages[chunk.toolName || ''] || 'Working...');
        } else if (chunk.type === 'tool-result') {
          setProcessingStatus('Analyzing results...');
        } else if (chunk.type === 'text') {
          setProcessingStatus('Responding...');
        }

        // Work with local contents array during streaming
        const updatedContents = [...streamingContents];

        // Process chunk
        if (chunk.type === 'text') {
          // Check if we already have cards (tool results) - if so, this is followup text
          const hasCards = updatedContents.some(c => c.type === 'task-list' || c.type === 'note-list');

          if (hasCards) {
            // Followup text after tool execution - check if we already have a followup text block
            const followupTextIdx = updatedContents.findIndex((c, idx) => {
              // Find text block that comes after cards
              if (c.type !== 'text') return false;
              const hasCardsBefore = updatedContents.slice(0, idx).some(x => x.type === 'task-list' || x.type === 'note-list');
              return hasCardsBefore;
            });

            if (followupTextIdx >= 0) {
              // Append to existing followup text
              updatedContents[followupTextIdx] = {
                ...updatedContents[followupTextIdx],
                content: (updatedContents[followupTextIdx].content || '') + chunk.content,
              };
            } else {
              // Create new followup text block
              updatedContents.push({ type: 'text', content: chunk.content });
            }
          } else {
            // Initial text - find or create first text block
            const textContentIdx = updatedContents.findIndex(c => c.type === 'text');
            if (textContentIdx >= 0) {
              // Append to existing initial text
              updatedContents[textContentIdx] = {
                ...updatedContents[textContentIdx],
                content: (updatedContents[textContentIdx].content || '') + chunk.content,
              };
            } else {
              // Create new initial text block
              updatedContents.push({ type: 'text', content: chunk.content });
            }
          }
        } else if (chunk.type === 'tool-use') {
          updatedContents.push({
            type: 'tool-use',
            toolName: chunk.toolName,
            toolStatus: 'pending',
          });
        } else if (chunk.type === 'tool-result') {
          console.log('[NedChat] Tool result chunk:', chunk);
          // Update tool status
          const toolIdx = updatedContents.findIndex(
            c => c.type === 'tool-use' && c.toolName === chunk.toolName
          );
          if (toolIdx >= 0) {
            updatedContents[toolIdx] = {
              ...updatedContents[toolIdx],
              toolStatus: chunk.isError ? 'error' : 'success',
            };
          }

          // Check for change tracking metadata
          if (chunk.result?.operation && chunk.result?.item_type) {
            const operation = chunk.result.operation;
            const itemType = chunk.result.item_type;
            const item = chunk.result.item;
            const changes = chunk.result.changes || [];

            console.log('[NedChat] Change tracking:', { operation, itemType, item, changes });

            if (operation === 'create') {
              // Add created card
              if (itemType === 'task' && item) {
                updatedContents.push({
                  type: 'task-created',
                  task: item,
                  timestamp: new Date().toISOString(),
                });
              } else if (itemType === 'note' && item) {
                updatedContents.push({
                  type: 'note-created',
                  note: item,
                  timestamp: new Date().toISOString(),
                });
              }
            } else if (operation === 'update' && changes.length > 0) {
              // Add update card
              if (itemType === 'task' && item) {
                updatedContents.push({
                  type: 'task-update',
                  taskId: item.id,
                  taskTitle: item.title,
                  changes,
                  timestamp: new Date().toISOString(),
                });
              } else if (itemType === 'note' && item) {
                updatedContents.push({
                  type: 'note-update',
                  noteId: item.id,
                  noteSummary: item.summary,
                  changes,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }

          // Add task/note/session lists if present in result (for query operations)
          if (chunk.result?.full_tasks && chunk.result.full_tasks.length > 0) {
            console.log('[NedChat] Adding task cards:', chunk.result.full_tasks.length);
            updatedContents.push({
              type: 'task-list',
              tasks: chunk.result.full_tasks,
            });
          }
          if (chunk.result?.full_notes && chunk.result.full_notes.length > 0) {
            console.log('[NedChat] Adding note cards:', chunk.result.full_notes.length);
            updatedContents.push({
              type: 'note-list',
              notes: chunk.result.full_notes,
            });
          }
          if (chunk.result?.full_sessions && chunk.result.full_sessions.length > 0) {
            console.log('[NedChat] Adding session cards:', chunk.result.full_sessions.length);
            updatedContents.push({
              type: 'session-list',
              sessions: chunk.result.full_sessions,
            });
          }
        } else if (chunk.type === 'thinking' && settingsState.nedSettings.showThinking) {
          updatedContents.push({
            type: 'thinking',
            content: chunk.content,
          });
        } else if (chunk.type === 'error') {
          updatedContents.push({
            type: 'error',
            content: chunk.content,
          });
        }

        // Update local contents
        streamingContents = updatedContents;

        // Dispatch the update to trigger UI re-render
        uiDispatch({
          type: 'UPDATE_NED_MESSAGE',
          payload: {
            id: assistantMsg.id,
            contents: updatedContents,
          },
        });
      }

      // Safety check: ensure we don't have an empty assistant message
      const finalMessages = uiState.nedConversation?.messages || [];
      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === assistantMsg.id && lastMsg.contents.length === 0) {
        console.warn('[NedChat] Empty assistant message detected, adding fallback');
        uiDispatch({
          type: 'UPDATE_NED_MESSAGE',
          payload: {
            id: assistantMsg.id,
            contents: [{
              type: 'text',
              content: "I'm sorry, I didn't generate a response. Please try asking again.",
            }],
          },
        });
      }

    } catch (err) {
      console.error('[NedChat] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);

      // Also add error to the assistant message so user sees something
      const finalMessages = uiState.nedConversation?.messages || [];
      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === assistantMsg.id && lastMsg.contents.length === 0) {
        uiDispatch({
          type: 'UPDATE_NED_MESSAGE',
          payload: {
            id: assistantMsg.id,
            contents: [{
              type: 'error',
              content: `Sorry, I encountered an error: ${errorMessage}`,
            }],
          },
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Task actions
  const handleTaskComplete = (taskId: string) => {
    tasksDispatch({ type: 'TOGGLE_TASK', payload: taskId });
  };

  const handleTaskEdit = (taskId: string) => {
    const task = tasksState.tasks.find(t => t.id === taskId);
    // Open task in sidebar
    uiDispatch({
      type: 'OPEN_SIDEBAR',
      payload: { type: 'task', itemId: taskId, label: task?.title || 'Task' },
    });
  };

  const handleTaskDelete = (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      tasksDispatch({ type: 'DELETE_TASK', payload: taskId });
    }
  };

  const handleTaskPriorityChange = (taskId: string, priority: Task['priority']) => {
    const task = tasksState.tasks.find(t => t.id === taskId);
    if (!task) return;
    tasksDispatch({
      type: 'UPDATE_TASK',
      payload: { ...task, priority },
    });
  };

  const handleTaskSubtaskToggle = (taskId: string, subtaskId: string) => {
    const task = tasksState.tasks.find(t => t.id === taskId);
    if (!task?.subtasks) return;

    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, done: !st.done } : st
    );

    tasksDispatch({
      type: 'UPDATE_TASK',
      payload: { ...task, subtasks: updatedSubtasks },
    });
  };

  const handleTaskReschedule = (taskId: string, date: string) => {
    const task = tasksState.tasks.find(t => t.id === taskId);
    if (!task) return;
    tasksDispatch({
      type: 'UPDATE_TASK',
      payload: { ...task, dueDate: date },
    });
  };

  // Note actions
  const handleNoteView = (noteId: string) => {
    const note = notesState.notes.find(n => n.id === noteId);
    uiDispatch({
      type: 'OPEN_SIDEBAR',
      payload: { type: 'note', itemId: noteId, label: note?.summary || 'Note' },
    });
  };

  const handleNoteEdit = (noteId: string) => {
    const note = notesState.notes.find(n => n.id === noteId);
    uiDispatch({
      type: 'OPEN_SIDEBAR',
      payload: { type: 'note', itemId: noteId, label: note?.summary || 'Note' },
    });
  };

  const handleNoteDelete = (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      // Note: This should ideally use useNotes().deleteNote() method
      // For now, dispatch directly (needs NotesContext to expose dispatch)
      console.warn('[NedChat] Note deletion should use useNotes().deleteNote() method');
    }
  };

  // Session actions - Navigate to sessions tab
  // Note: Session selection is now managed locally in SessionsZone
  // User will need to click the session after navigating to the tab
  const handleSessionView = (sessionId: string) => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
    // TODO: Add mechanism to pass selectedSessionId to SessionsZone via URL params or UI context
    console.log('[NedChat] Navigating to sessions tab for session:', sessionId);
  };

  // Ask Ned handler - append to input or send directly
  const handleAskNed = (context: string) => {
    setInput(context);
    // Focus input
    inputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col px-6 pb-6 pt-4">
      {/* Messages Area - Scrollable, glassy container */}
      <div className={`${CHAT_STYLES.container} mb-4 overflow-hidden flex flex-col relative`}>
        {/* Ned Welcome Tooltip */}
        <FeatureTooltip
          show={showNedWelcome}
          onDismiss={() => {
            setShowNedWelcome(false);
            uiDispatch({ type: 'MARK_FEATURE_INTRODUCED', payload: 'nedAssistant' });
          }}
          position="center"
          title="🤖 Meet Ned - Your AI Assistant"
          message={
            <div>
              <p>Ask me anything about your work:</p>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>"What tasks are due this week?"</li>
                <li>"Summarize my meeting with Acme"</li>
                <li>"Create a task to follow up with Sarah"</li>
              </ul>
              <p className="mt-3">I can read, search, create, and update your data.</p>
              <p className="mt-2 font-medium text-cyan-600">
                Try asking: "What have I been working on?"
              </p>
            </div>
          }
          primaryAction={{
            label: "Let's try it",
            onClick: () => {
              setInput("What have I been working on?");
              inputRef.current?.focus();
            },
          }}
          secondaryAction={{
            label: 'Dismiss',
            onClick: () => {},
          }}
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
          {/* API Key Warning */}
          {!hasApiKey && (
            <div className={CHAT_STYLES.banner.warning}>
              <div className="flex-shrink-0 w-5 h-5 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg flex items-center justify-center shadow-md">
                <AlertCircle className="w-3 h-3 text-white" />
              </div>
              <p className="text-sm font-medium text-yellow-700 leading-relaxed">
                Please add your Claude API key in Settings to use Ned
              </p>
            </div>
          )}

          {messages.length === 0 && hasApiKey && (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 via-teal-400 to-teal-500 rounded-[24px] flex items-center justify-center mb-5 shadow-2xl shadow-cyan-200/50 ring-2 ring-white/60 transform hover:scale-105 transition-all">
                <span className="text-4xl">👋</span>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                Hi! I'm Ned
              </h2>
              <p className="text-gray-600 max-w-md text-[15px] font-medium leading-relaxed">
                I can help you find notes, create tasks, and answer questions about your work.
                Just ask me anything!
              </p>
            </div>
          )}

          {messages.map((message) => (
            <NedMessage
              key={message.id}
              message={message}
              onTaskComplete={handleTaskComplete}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
              onTaskPriorityChange={handleTaskPriorityChange}
              onTaskSubtaskToggle={handleTaskSubtaskToggle}
              onTaskReschedule={handleTaskReschedule}
              onNoteView={handleNoteView}
              onNoteEdit={handleNoteEdit}
              onNoteDelete={handleNoteDelete}
              onSessionView={handleSessionView}
              onAskNed={handleAskNed}
              allNotes={notesState.notes}
              allTasks={tasksState.tasks}
              allSessions={sessions}
              companies={entitiesState.companies}
              contacts={entitiesState.contacts}
            />
          ))}

          {isProcessing && (
            <div className={CHAT_STYLES.banner.info}>
              <motion.div
                className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 via-teal-400 to-teal-500 flex items-center justify-center shadow-xl ring-2 ring-white/60"
                animate={{
                  scale: [1, 1.05, 1],
                  boxShadow: [
                    '0 20px 25px -5px rgba(6, 182, 212, 0.3), 0 0 0 2px rgba(255, 255, 255, 0.6)',
                    '0 25px 30px -5px rgba(6, 182, 212, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.6)',
                    '0 20px 25px -5px rgba(6, 182, 212, 0.3), 0 0 0 2px rgba(255, 255, 255, 0.6)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Loader2 className="w-4 h-4 text-white animate-spin drop-shadow-sm" />
              </motion.div>
              <div className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-bounce [animation-delay:0ms] shadow-sm" />
                  <span className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-bounce [animation-delay:150ms] shadow-sm" />
                  <span className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-bounce [animation-delay:300ms] shadow-sm" />
                </div>
                <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  {processingStatus}
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="px-5 py-3.5 bg-gradient-to-r from-red-50/80 to-rose-50/80 backdrop-blur-xl border-2 border-red-200/60 rounded-[20px] shadow-xl shadow-red-100/30 ring-1 ring-red-100/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-700 flex-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Input Bar - Glassy Pill */}
      <div className="flex-shrink-0">
        <div className={CHAT_STYLES.inputBar}>
          <div className="flex items-center gap-3">
            {messages.length > 0 && !isProcessing && (
              <button
                onClick={() => {
                  if (confirm('Clear this conversation and start fresh with Ned?')) {
                    uiDispatch({ type: 'CLEAR_NED_CONVERSATION' });
                  }
                }}
                className="flex-shrink-0 w-9 h-9 text-gray-600 hover:text-cyan-600 rounded-full hover:bg-white/60 transition-all duration-200 flex items-center justify-center"
                title="Clear conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasApiKey ? "Ask Ned anything..." : "Add API key in Settings first"}
                disabled={!hasApiKey || isProcessing}
                rows={1}
                className="w-full px-3 py-2 bg-transparent text-gray-900 placeholder:text-gray-400 resize-none max-h-32 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:outline-none focus:ring-0"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!hasApiKey || !input.trim() || isProcessing}
              className="flex-shrink-0 w-9 h-9 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-full font-medium shadow-lg shadow-cyan-200/50 hover:scale-105 hover:shadow-xl hover:shadow-cyan-300/60 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg flex items-center justify-center"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Permission Dialog */}
      <PermissionDialog
        isOpen={permissionRequest !== null}
        toolName={permissionRequest?.toolName || ''}
        toolDescription={permissionRequest?.toolDescription || ''}
        context={permissionRequest?.context}
        onGrant={handlePermissionGrant}
        onDeny={handlePermissionDeny}
      />
    </div>
  );
};
