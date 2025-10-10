/**
 * Ned Chat Interface
 *
 * Main chat component for Ned AI assistant.
 * Handles conversation flow, streaming, tool execution, and permissions.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { nedService } from '../../services/nedService';
import { contextAgent } from '../../services/contextAgent';
import { NedToolExecutor } from '../../services/nedToolExecutor';
import { NedMessage } from './NedMessage';
import { PermissionDialog } from './PermissionDialog';
import { TOOL_DESCRIPTIONS } from '../../services/nedTools';
import type { Task, Note } from '../../types';

const CONVERSATION_ID = 'main'; // For now, single conversation

interface MessageContent {
  type: 'text' | 'task-list' | 'note-list' | 'tool-use' | 'tool-result' | 'error' | 'thinking';
  content?: string;
  tasks?: Task[];
  notes?: Note[];
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
  const { state, dispatch } = useApp();
  const messages = state.nedConversation?.messages || [];
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('Thinking...');
  const [error, setError] = useState<string | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<ToolPermissionRequest | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Initialize services
  useEffect(() => {
    const apiKey = localStorage.getItem('claude-api-key');
    if (apiKey) {
      nedService.setApiKey(apiKey);
      contextAgent.setApiKey(apiKey);
    }
  }, []);

  // Permission checker function
  const checkPermission = useCallback(async (toolName: string, context?: string): Promise<boolean> => {
    // Check if permission already granted
    const allPermissions = [...state.nedSettings.permissions, ...state.nedSettings.sessionPermissions];
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
            dispatch({
              type: 'GRANT_NED_PERMISSION',
              payload: { toolName, level },
            });
          }
          resolve(granted);
        },
      });
    });
  }, [state.nedSettings, dispatch]);

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

  // Tool executor
  const createToolExecutor = useCallback(() => {
    return new NedToolExecutor(state, dispatch);
  }, [state, dispatch]);

  // Send message
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setIsProcessing(true);

    // Add user message
    const userMsg: NedMessageData = {
      id: `msg_${Date.now()}`,
      role: 'user',
      contents: [{ type: 'text', content: userMessage }],
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NED_MESSAGE', payload: userMsg });

    // Prepare assistant message
    const assistantMsg: NedMessageData = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      contents: [],
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_NED_MESSAGE', payload: assistantMsg });

    // Track contents locally during streaming
    let streamingContents: MessageContent[] = [];

    try {
      const toolExecutor = createToolExecutor();

      console.log('[NedChat] Sending message:', userMessage);

      // Stream response
      for await (const chunk of nedService.sendMessage(
        CONVERSATION_ID,
        userMessage,
        state,
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

          // Add task/note lists if present in result
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
        } else if (chunk.type === 'thinking' && state.nedSettings.showThinking) {
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
        dispatch({
          type: 'UPDATE_NED_MESSAGE',
          payload: {
            id: assistantMsg.id,
            contents: updatedContents,
          },
        });
      }

      // Safety check: ensure we don't have an empty assistant message
      const finalMessages = state.nedConversation?.messages || [];
      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === assistantMsg.id && lastMsg.contents.length === 0) {
        console.warn('[NedChat] Empty assistant message detected, adding fallback');
        dispatch({
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
      const finalMessages = state.nedConversation?.messages || [];
      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === assistantMsg.id && lastMsg.contents.length === 0) {
        dispatch({
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
    dispatch({ type: 'TOGGLE_TASK', payload: taskId });
  };

  const handleTaskEdit = (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    // Open task in sidebar
    dispatch({
      type: 'OPEN_SIDEBAR',
      payload: { type: 'task', itemId: taskId, label: task?.title || 'Task' },
    });
  };

  const handleTaskDelete = (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      dispatch({ type: 'DELETE_TASK', payload: taskId });
    }
  };

  const handleTaskPriorityChange = (taskId: string, priority: Task['priority']) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    dispatch({
      type: 'UPDATE_TASK',
      payload: { ...task, priority },
    });
  };

  const handleTaskSubtaskToggle = (taskId: string, subtaskId: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task?.subtasks) return;

    const updatedSubtasks = task.subtasks.map(st =>
      st.id === subtaskId ? { ...st, done: !st.done } : st
    );

    dispatch({
      type: 'UPDATE_TASK',
      payload: { ...task, subtasks: updatedSubtasks },
    });
  };

  const handleTaskReschedule = (taskId: string, date: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    dispatch({
      type: 'UPDATE_TASK',
      payload: { ...task, dueDate: date },
    });
  };

  // Note actions
  const handleNoteView = (noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    dispatch({
      type: 'OPEN_SIDEBAR',
      payload: { type: 'note', itemId: noteId, label: note?.summary || 'Note' },
    });
  };

  const handleNoteEdit = (noteId: string) => {
    const note = state.notes.find(n => n.id === noteId);
    dispatch({
      type: 'OPEN_SIDEBAR',
      payload: { type: 'note', itemId: noteId, label: note?.summary || 'Note' },
    });
  };

  const handleNoteDelete = (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      dispatch({ type: 'DELETE_NOTE', payload: noteId });
    }
  };

  // Ask Ned handler - append to input or send directly
  const handleAskNed = (context: string) => {
    setInput(context);
    // Focus input
    inputRef.current?.focus();
  };

  const apiKey = localStorage.getItem('claude-api-key');

  return (
    <div className="h-full flex flex-col items-center justify-center px-8 pb-8 pt-4">
      {/* API Key Warning */}
      {!apiKey && (
        <div className="w-full max-w-4xl mb-6 flex items-center gap-2 px-5 py-3 bg-yellow-50/70 backdrop-blur-xl border-2 border-yellow-100 shadow-lg" style={{ borderRadius: '9999px' }}>
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <p className="text-sm text-yellow-700">
            Please add your Claude API key in Settings to use Ned
          </p>
        </div>
      )}

      {/* Chat Container - Frosted Glass Background */}
      <div className="flex-1 w-full max-w-4xl bg-white/30 backdrop-blur-xl border-2 border-white/60 shadow-2xl shadow-cyan-200/30 overflow-hidden flex flex-col" style={{ borderRadius: '48px' }}>
        {/* Messages Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-6 scrollbar-hide">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-cyan-200/50">
                <span className="text-3xl">👋</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Hi! I'm Ned
              </h2>
              <p className="text-gray-600 max-w-md">
                I'm your AI assistant. I can help you find notes, create tasks, and answer questions about your work.
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
              onAskNed={handleAskNed}
              allNotes={state.notes}
              allTasks={state.tasks}
              companies={state.companies}
              contacts={state.contacts}
            />
          ))}

          {isProcessing && (
            <div className="flex items-center gap-3">
              <motion.div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-200/50"
                animate={{
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    '0 10px 15px -3px rgba(6, 182, 212, 0.3)',
                    '0 20px 25px -5px rgba(6, 182, 212, 0.5)',
                    '0 10px 15px -3px rgba(6, 182, 212, 0.3)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </motion.div>
              <div className="flex items-center gap-2 text-sm text-cyan-600 font-medium">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                {processingStatus}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-6 py-3 bg-red-50/70 backdrop-blur-xl border-t-2 border-red-100">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Floating Input Bar - Like Navigation Island */}
      <div className="w-full max-w-4xl mt-6">
        <div className="bg-white/50 backdrop-blur-xl border-2 border-white/60 shadow-2xl shadow-cyan-200/30 px-5 py-4" style={{ borderRadius: '9999px' }}>
          <div className="flex items-center gap-3">
            {messages.length > 0 && !isProcessing && (
              <button
                onClick={() => {
                  if (confirm('Clear this conversation and start fresh with Ned?')) {
                    dispatch({ type: 'CLEAR_NED_CONVERSATION' });
                  }
                }}
                className="flex-shrink-0 w-10 h-10 text-gray-600 hover:text-cyan-600 rounded-full hover:bg-white/60 transition-all duration-200 flex items-center justify-center"
                title="Clear conversation"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={apiKey ? "Ask Ned anything..." : "Add API key in Settings first"}
                disabled={!apiKey || isProcessing}
                rows={1}
                className="w-full px-4 py-3 bg-transparent text-gray-900 placeholder:text-gray-400 resize-none max-h-32 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-0 focus:outline-none focus:ring-0"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!apiKey || !input.trim() || isProcessing}
              className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-full font-medium shadow-lg shadow-cyan-200/50 hover:scale-105 hover:shadow-xl hover:shadow-cyan-300/60 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg flex items-center justify-center"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
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
