/**
 * Ned Chat (Simplified) - leveraging baleybots alpha17 new APIs
 * 
 * Key improvements:
 * - Direct use of UIChatMessage (OpenAI format is now standard)
 * - Leverages built-in streaming events
 * - Zod-based tool definitions
 * - Simplified message handling
 * - Removed manual message conversion
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useUI } from '../../context/UIContext';
import { useSettings } from '../../context/SettingsContext';
import { useNotes } from '../../context/NotesContext';
import { useTasks } from '../../context/TasksContext';
import { useSessions } from '../../context/SessionsContext';
import { useEntities } from '../../context/EntitiesContext';
import { FeatureTooltip } from '../FeatureTooltip';
import { CHAT_STYLES } from '../../design-system/theme';
import { useChat, type UIChatMessage } from '@baleybots/react';
import { useTauriApiKey } from '../../hooks/useTauriApiKey';
import { NedToolExecutor } from '../../services/nedToolExecutor';
import { NedMessage } from './NedMessage';
import { PermissionDialog } from './PermissionDialog';
import { getAllNedTools, toolRequiresPermission } from '../../services/nedToolsZod';
import type { Task, Note } from '../../types';

interface ToolPermissionRequest {
  toolName: string;
  toolDescription: string;
  context?: string;
  resolve: (granted: boolean, level?: 'forever' | 'session' | 'always-ask') => void;
}

// Tool descriptions for permission dialog
const TOOL_DESCRIPTIONS: Record<string, string> = {
  create_task: 'Create new tasks in your todo list',
  update_task: 'Modify existing tasks',
  complete_task: 'Mark tasks as completed',
  delete_task: 'Remove tasks from your todo list',
  create_note: 'Create new notes',
  update_note: 'Modify existing notes',
  delete_note: 'Remove notes',
  record_memory: 'Save information about your preferences and habits',
};

export const NedChatSimplified: React.FC = () => {
  const { state: uiState, dispatch: uiDispatch } = useUI();
  const { state: settingsState, dispatch: settingsDispatch } = useSettings();
  const { state: notesState } = useNotes();
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { sessions, setActiveSession } = useSessions();
  const { state: entitiesState } = useEntities();

  const [input, setInput] = useState('');
  const [showNedWelcome, setShowNedWelcome] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState<ToolPermissionRequest | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { apiKey, hasApiKey } = useTauriApiKey();

  // Check permission for a tool
  const checkPermission = useCallback(async (toolName: string, context?: string): Promise<boolean> => {
    // Read tools don't need permission
    if (!toolRequiresPermission(toolName)) {
      return true;
    }

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
              payload: { 
                toolName, 
                level,
                sessionOnly: level === 'session',
              },
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

  // Create tool executor
  const createToolExecutor = useCallback(() => {
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

    const combinedDispatch = (action: any) => {
      if (action.type.startsWith('ADD_TASK') || action.type.startsWith('UPDATE_TASK') || action.type.startsWith('DELETE_TASK') || action.type.startsWith('TOGGLE_TASK') || action.type.startsWith('BATCH_') && action.type.includes('TASK')) {
        tasksDispatch(action);
      } else if (action.type.startsWith('SET_ACTIVE_TAB') || action.type.startsWith('OPEN_SIDEBAR') || action.type.includes('_NED_')) {
        uiDispatch(action);
      } else if (action.type.includes('NED_PERMISSION') || action.type.includes('_SETTINGS')) {
        settingsDispatch(action);
      }
    };

    return new NedToolExecutor(reconstructedState, combinedDispatch);
  }, [tasksState, notesState, sessions, entitiesState, uiState, settingsState, tasksDispatch, uiDispatch, settingsDispatch]);

  // Create tools with execution functions using Zod schemas
  // Baleybots supports Zod schemas directly via ZodToolDefinition!
  const tools = useMemo(() => {
    const toolExecutor = createToolExecutor();
    const allTools = getAllNedTools();
    
    // Baleybots accepts ZodToolDefinition format: { description, schema, function }
    const baleybotTools: Record<string, any> = {};
    
    for (const [toolName, toolDef] of Object.entries(allTools)) {
      baleybotTools[toolName] = {
        description: toolDef.description,
        schema: toolDef.schema, // Zod schema - baleybots handles this natively!
        function: async (args: any) => {
          console.log(`[NedChat] Executing tool: ${toolName}`, args);
          
          // Check permission for write tools
          const hasPermission = await checkPermission(toolName);
          if (!hasPermission) {
            console.log(`[NedChat] Permission denied for tool: ${toolName}`);
            throw new Error('Permission denied by user');
          }
          
          // Execute the tool
          const result = await toolExecutor.execute({ id: 'temp', name: toolName, input: args });
          console.log(`[NedChat] Tool result for ${toolName}:`, result);
          
          // If there's an error, throw it
          if (result.is_error) {
            throw new Error(typeof result.content === 'string' ? result.content : JSON.stringify(result.content));
          }
          
          // Return the content - baleybots will format it as a tool result message
          return result.content;
        },
      };
    }
    
    return baleybotTools;
  }, [createToolExecutor, checkPermission]);

  // Initialize useChat with tools
  const { messages, isStreaming, isLoading, error, sendStreaming, clearHistory } = useChat<string>({
    apiKey: apiKey || undefined,
    systemPrompt: 'You are Ned, a helpful AI assistant inside Taskerino. You can search for notes and tasks, get details about work sessions, and help the user manage their work. Be concise and helpful.',
    tools,
  });

  const isProcessing = isStreaming || isLoading;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

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

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput('');
    uiDispatch({ type: 'INCREMENT_ONBOARDING_STAT', payload: 'nedQueryCount' });
    await sendStreaming(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Extract task/note data from tool result messages for rendering
  const getToolResultData = useCallback((msg: UIChatMessage) => {
    if (msg.role !== 'tool' || !msg.content) return null;
    
    try {
      const result = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
      return result;
    } catch (e) {
      console.error('[NedChat] Failed to parse tool result:', e);
      return null;
    }
  }, []);

  // Task actions
  const handleTaskComplete = (taskId: string) => {
    tasksDispatch({ type: 'TOGGLE_TASK', payload: taskId });
  };

  const handleTaskEdit = (taskId: string) => {
    const task = tasksState.tasks.find(t => t.id === taskId);
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
      console.warn('[NedChat] Note deletion should use useNotes().deleteNote() method');
    }
  };

  const handleSessionView = (sessionId: string) => {
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
    setActiveSession(sessionId);
  };

  const handleAskNed = (context: string) => {
    setInput(context);
    inputRef.current?.focus();
  };

  // Render messages using NedMessage component
  // We need to convert UIChatMessage to our NedMessageData format
  // But now it's much simpler since UIChatMessage is already in the right format
  const renderMessages = useMemo(() => {
    console.log('[NedChat] Rendering messages:', messages.length, messages);
    return messages.map((msg) => {
      // For tool messages, extract the data for rendering
      if (msg.role === 'tool') {
        console.log('[NedChat] Processing tool message:', msg);
        const toolData = getToolResultData(msg);
        console.log('[NedChat] Tool data:', toolData);
        
        // Create a simplified message for NedMessage component
        const nedMsg = {
          id: msg.id,
          role: 'assistant' as const,
          contents: toolData ? [
            // Render task lists
            ...(toolData.full_tasks && toolData.full_tasks.length > 0 ? [{
              type: 'task-list' as const,
              tasks: toolData.full_tasks,
            }] : []),
            // Render note lists
            ...(toolData.full_notes && toolData.full_notes.length > 0 ? [{
              type: 'note-list' as const,
              notes: toolData.full_notes,
            }] : []),
            // Render session lists
            ...(toolData.full_sessions && toolData.full_sessions.length > 0 ? [{
              type: 'session-list' as const,
              sessions: toolData.full_sessions,
            }] : []),
            // Render task/note creation
            ...(toolData.operation === 'create' && toolData.item_type === 'task' && toolData.item ? [{
              type: 'task-created' as const,
              task: toolData.item,
              timestamp: new Date().toISOString(),
            }] : []),
            ...(toolData.operation === 'create' && toolData.item_type === 'note' && toolData.item ? [{
              type: 'note-created' as const,
              note: toolData.item,
              timestamp: new Date().toISOString(),
            }] : []),
          ] : [],
          timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
        };
        
        console.log('[NedChat] Converted to NedMessage:', nedMsg);
        return nedMsg.contents.length > 0 ? nedMsg : null;
      }
      
      // For user and assistant messages, render as text
      if (msg.role === 'user' || (msg.role === 'assistant' && msg.content && !msg.tool_calls)) {
        return {
          id: msg.id,
          role: msg.role,
          contents: [{
            type: 'text' as const,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          }],
          timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
        };
      }
      
      // For assistant messages with tool calls, show tool-use indicators
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        console.log('[NedChat] Processing assistant message with tool calls:', msg.tool_calls);
        return {
          id: msg.id,
          role: 'assistant' as const,
          contents: msg.tool_calls.map((toolCall: any) => ({
            type: 'tool-use' as const,
            toolName: toolCall.function?.name || toolCall.name,
            toolStatus: 'pending' as const,
          })),
          timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
        };
      }
      
      return null;
    }).filter(Boolean);
  }, [messages, getToolResultData]);

  return (
    <div className="h-full flex flex-col px-6 pb-6 pt-4 relative">
      <div className={`${CHAT_STYLES.container} mb-4 overflow-hidden flex flex-col relative`}>
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
              <p className="mt-3">I can help with general questions, too.</p>
              <p className="mt-2 font-medium text-cyan-600">Try asking: "What have I been working on?"</p>
            </div>
          }
          primaryAction={{
            label: "Let's try it",
            onClick: () => {
              setInput('What have I been working on?');
              inputRef.current?.focus();
            },
          }}
          secondaryAction={{ label: 'Dismiss', onClick: () => {} }}
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-4 scrollbar-hide">
          {!hasApiKey && (
            <div className={CHAT_STYLES.banner.warning}>
              <div className="flex-shrink-0 w-5 h-5 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg flex items-center justify-center shadow-md">
                <AlertCircle className="w-3 h-3 text-white" />
              </div>
              <p className="text-sm font-medium text-yellow-700 leading-relaxed">Please add your OpenAI API key in Settings to use Ned</p>
            </div>
          )}

          {messages.length === 0 && hasApiKey && (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 via-teal-400 to-teal-500 rounded-[24px] flex items-center justify-center mb-5 shadow-2xl shadow-cyan-200/50 ring-2 ring-white/60 transform hover:scale-105 transition-all">
                <span className="text-4xl">👋</span>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">Hi! I'm Ned</h2>
              <p className="text-gray-600 max-w-md text-[15px] font-medium leading-relaxed">I can search notes and tasks, get session details, and help you manage your work. Just ask me anything!</p>
            </div>
          )}

          {renderMessages.map((message: any) => (
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
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Loader2 className="w-4 h-4 text-white animate-spin drop-shadow-sm" />
              </motion.div>
              <div className="flex items-center gap-2.5 text-sm font-semibold">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-bounce [animation-delay:0ms] shadow-sm" />
                  <span className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-bounce [animation-delay:150ms] shadow-sm" />
                  <span className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-bounce [animation-delay:300ms] shadow-sm" />
                </div>
                <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="px-5 py-3.5 bg-gradient-to-r from-red-50/80 to-rose-50/80 backdrop-blur-xl border-2 border-red-200/60 rounded-[20px] shadow-xl shadow-red-100/30 ring-1 ring-red-100/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-700 flex-1 leading-relaxed">{error.message}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0">
        <div className={CHAT_STYLES.inputBar}>
          <div className="flex items-center gap-3">
            {messages.length > 0 && !isProcessing && (
              <button
                onClick={() => {
                  if (confirm('Clear this conversation and start fresh with Ned?')) {
                    clearHistory();
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
                placeholder={hasApiKey ? 'Ask Ned anything...' : 'Add API key in Settings first'}
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
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Permission Dialog */}
      <PermissionDialog
        isOpen={!!permissionRequest}
        toolName={permissionRequest?.toolName || ''}
        toolDescription={permissionRequest?.toolDescription || ''}
        context={permissionRequest?.context}
        onGrant={handlePermissionGrant}
        onDeny={handlePermissionDeny}
      />
    </div>
  );
};

