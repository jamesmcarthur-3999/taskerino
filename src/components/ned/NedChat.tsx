/**
 * Ned Chat Interface
 *
 * Main chat component for Ned AI assistant.
 * Handles conversation flow, streaming, tool execution, and permissions.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useChat } from '@baleybots/react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { Send, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useUI } from '../../context/UIContext';
import { useNotes } from '../../context/NotesContext';
import { useTasks } from '../../context/TasksContext';
import { useSessionList } from '../../context/SessionListContext';
import { useActiveSession } from '../../context/ActiveSessionContext';
import { useEntities } from '../../context/EntitiesContext';
import { nedServiceBaleybots as nedService } from '../../services/nedServiceBaleybots';
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
  toolArguments?: Record<string, unknown>;
  toolResult?: string; // Tool result content when combined with tool-use
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
  const { activeSession } = useActiveSession();
  const { state: entitiesState } = useEntities();

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
      activeSessionId: activeSession?.id ?? null,
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
  }, [tasksState, notesState, sessions, entitiesState, uiState, settingsState, tasksDispatch, uiDispatch, settingsDispatch, activeSession]);

  // Create bot instance for useChat
  const chatBot = useMemo(() => {
    if (!hasApiKey) return null;
    
    const toolExecutor = createToolExecutor();
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
      activeSessionId: activeSession?.id ?? null,
      nedConversation: uiState.nedConversation,
    } as any;

    return nedService.createBot(
      CONVERSATION_ID,
      reconstructedState,
      async (toolCall) => {
        console.log('[NedChat] Executing tool:', toolCall.name, toolCall.input);
        const result = await toolExecutor.execute(toolCall);
        console.log('[NedChat] Tool result:', result);
        return result;
      },
      checkPermission
    );
  }, [hasApiKey, tasksState, notesState, sessions, entitiesState, uiState, settingsState, activeSession, createToolExecutor, checkPermission]);

  // Use useChat hook - must be declared after chatBot is defined
  const { messages: chatMessages, sendStreaming, isStreaming, error: chatError } = useChat({
    chatBot: chatBot || undefined,
    onToolCall: async (toolName: string, args: Record<string, unknown>, result: unknown) => {
      // Tool execution is handled by the bot's tool definitions
      // This callback is for UI updates if needed
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
      setProcessingStatus(statusMessages[toolName] || 'Working...');
    },
  });

  // Convert chatMessages to NedMessageData format for rendering - memoized to prevent re-renders
  // NOTE: This updates automatically during streaming as useChat receives onToken events
  const messages = useMemo(() => {
    console.log('[NedChat] chatMessages from useChat:', chatMessages.length, 'messages');
    
    // Log each message structure to debug streaming
    chatMessages.forEach((msg, idx) => {
      const contentLength = typeof msg.content === 'string' ? msg.content.length : 0;
      const contentPreview = typeof msg.content === 'string' ? msg.content.substring(0, 50) : 'no content';
      console.log(`[NedChat] Message ${idx}:`, {
        role: msg.role,
        contentLength,
        contentPreview: contentLength > 0 ? contentPreview : 'empty',
        hasToolCalls: !!msg.tool_calls,
        toolCallCount: Array.isArray(msg.tool_calls) ? msg.tool_calls.length : 0,
        isStreaming,
        id: msg.id,
      });
    });
    
    // First pass: process all messages into a flat structure
    const processedMessages = chatMessages.map((msg) => {
      const contents: MessageContent[] = [];
      
      // Handle tool result messages (role: "tool")
      // Baleybots returns tool results as messages with role "tool"
      if (msg.role === 'tool') {
        // Tool results come as messages with role "tool" and content
        if (msg.content && typeof msg.content === 'string') {
          // Try to parse as JSON to extract structured data
          let toolResult: Record<string, unknown> | string = msg.content;
          try {
            toolResult = JSON.parse(msg.content);
          } catch (e) {
            // Not JSON, keep as string
          }
          
          contents.push({
            type: 'tool-result',
            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
            toolName: 'tool_result', // Could extract from content if structured
          });
        }
        // Return tool result message - show as assistant message
        return {
          id: msg.id || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant' as 'user' | 'assistant', // Tool results are shown as assistant messages
          contents,
          timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : (msg.timestamp instanceof Date ? msg.timestamp.toISOString() : new Date().toISOString()),
        };
      }
      
      // Handle text content - this includes partial content during streaming
      if (msg.content && typeof msg.content === 'string') {
        contents.push({ type: 'text', content: msg.content });
        // Log streaming updates for debugging
        if (isStreaming && msg.role === 'assistant' && msg.content.length > 0) {
          console.log('[NedChat] Streaming message update:', msg.content.substring(0, 50) + '...');
        }
      }
      
      // Handle tool calls - these appear during streaming as tools are called
      // Baleybots uses OpenAI format: {id, type: "function", function: {name, arguments}}
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        console.log('[NedChat] Processing tool_calls:', msg.tool_calls.length, 'tool calls');
        console.log('[NedChat] Tool calls structure:', JSON.stringify(msg.tool_calls, null, 2));
        for (const toolCall of msg.tool_calls) {
          console.log('[NedChat] Processing tool call:', toolCall);
          
          // Extract from OpenAI-compatible format used by baleybots
          let toolName = 'unknown';
          let toolArguments: Record<string, unknown> = {};
          
          if (toolCall && typeof toolCall === 'object') {
            // Baleybots/OpenAI format: {id, type: "function", function: {name, arguments}}
            if (toolCall.function && typeof toolCall.function === 'object') {
              toolName = String(toolCall.function.name || 'unknown');
              // Arguments come as a JSON string that needs parsing
              if (toolCall.function.arguments && typeof toolCall.function.arguments === 'string') {
                try {
                  toolArguments = JSON.parse(toolCall.function.arguments);
                } catch (e) {
                  console.warn('[NedChat] Failed to parse tool arguments:', e);
                  toolArguments = {};
                }
              }
            }
          }
          
          console.log('[NedChat] Extracted tool:', toolName, toolArguments);
          contents.push({
            type: 'tool-use',
            toolName,
            toolStatus: 'pending',
            toolArguments,
          });
        }
      }
      
      return {
        id: msg.id || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        contents,
        timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : (msg.timestamp instanceof Date ? msg.timestamp.toISOString() : new Date().toISOString()),
      };
    });
    
    // Second pass: combine tool-use with tool-result
    // Look for consecutive tool-use and tool-result content items and combine them
    const combinedMessages: NedMessageData[] = [];
    const usedToolResults = new Set<string>(); // Track which tool results have been used
    
    for (let msgIdx = 0; msgIdx < processedMessages.length; msgIdx++) {
      const msg = processedMessages[msgIdx];
      const newContents: MessageContent[] = [];
      const usedIndices = new Set<number>(); // Track which indices in this message are used
      
      for (let contentIdx = 0; contentIdx < msg.contents.length; contentIdx++) {
        if (usedIndices.has(contentIdx)) continue; // Skip already used items
        
        const content = msg.contents[contentIdx];
        
        if (content.type === 'tool-use') {
          // Look for a matching tool-result in the same message or next message
          let matchedResult: string | null = null;
          
          // Check remaining contents in same message
          for (let i = contentIdx + 1; i < msg.contents.length; i++) {
            if (msg.contents[i].type === 'tool-result' && !usedIndices.has(i)) {
              const resultKey = `${msgIdx}-${i}`;
              if (!usedToolResults.has(resultKey)) {
                matchedResult = msg.contents[i].content || null;
                usedToolResults.add(resultKey);
                usedIndices.add(i);
                break;
              }
            }
          }
          
          // If not found in same message, check next message
          if (!matchedResult && msgIdx + 1 < processedMessages.length) {
            const nextMsg = processedMessages[msgIdx + 1];
            for (let i = 0; i < nextMsg.contents.length; i++) {
              if (nextMsg.contents[i].type === 'tool-result') {
                const resultKey = `${msgIdx + 1}-${i}`;
                if (!usedToolResults.has(resultKey)) {
                  matchedResult = nextMsg.contents[i].content || null;
                  usedToolResults.add(resultKey);
                  break;
                }
              }
            }
          }
          
          // Combine tool-use with tool-result
          if (matchedResult) {
            newContents.push({
              ...content,
              toolResult: matchedResult,
              toolStatus: 'success',
            });
          } else {
            // No result yet, keep as-is
            newContents.push(content);
          }
        } else if (content.type === 'tool-result') {
          // Check if this result was already matched to a tool-use
          const resultKey = `${msgIdx}-${contentIdx}`;
          if (!usedToolResults.has(resultKey)) {
            // This tool result wasn't matched, keep it as fallback
            newContents.push(content);
          }
        } else {
          // Keep other content types as-is
          newContents.push(content);
        }
      }
      
      // Only add message if it has contents
      if (newContents.length > 0) {
        combinedMessages.push({
          ...msg,
          contents: newContents,
        });
      }
    }
    
    return combinedMessages;
  }, [chatMessages, isStreaming]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update isProcessing state from useChat
  useEffect(() => {
    setIsProcessing(isStreaming);
    if (isStreaming) {
      setProcessingStatus('Responding...');
    }
  }, [isStreaming]);

  // Handle chat errors
  useEffect(() => {
    if (chatError) {
      setError(chatError instanceof Error ? chatError.message : String(chatError));
    }
  }, [chatError]);

  // Send message using useChat
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing || !chatBot) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Track Ned query stat
    uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'nedQueryCount' });

    try {
      await sendStreaming(userMessage);
    } catch (err) {
      console.error('[NedChat] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
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

  // Session actions - Navigate to sessions tab and select session
  const handleSessionView = (sessionId: string) => {
    // Navigate to sessions tab
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
    // Note: Session selection is handled by SessionsZone component
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
