/**
 * Ned Tool Executor
 *
 * Executes tools called by Ned and returns results.
 * Connects Ned's tool calls to actual app state and actions.
 */

import type { AppState } from '../types';
import type { ToolCall, ToolResult } from './nedTools';
import { contextAgent } from './contextAgent';
import { nedMemory } from './nedMemory';
import { generateId } from '../utils/helpers';

type DispatchFunction = (action: any) => void;

export class NedToolExecutor {
  private appState: AppState;
  private dispatch: DispatchFunction;

  constructor(appState: AppState, dispatch: DispatchFunction) {
    this.appState = appState;
    this.dispatch = dispatch;
  }

  /**
   * Execute a tool and return result
   */
  async execute(tool: ToolCall): Promise<ToolResult> {
    try {
      switch (tool.name) {
        // ==================== READ TOOLS ====================

        case 'query_context_agent':
          return await this.queryContextAgent(tool);

        case 'get_current_datetime':
          return this.getCurrentDatetime(tool);

        case 'get_user_context':
          return this.getUserContext(tool);

        case 'recall_memory':
          return this.recallMemory(tool);

        case 'get_item_details':
          return this.getItemDetails(tool);

        // ==================== WRITE TOOLS ====================

        case 'create_task':
          return this.createTask(tool);

        case 'update_task':
          return this.updateTask(tool);

        case 'complete_task':
          return this.completeTask(tool);

        case 'delete_task':
          return this.deleteTask(tool);

        case 'create_note':
          return this.createNote(tool);

        case 'update_note':
          return this.updateNote(tool);

        case 'delete_note':
          return this.deleteNote(tool);

        case 'record_memory':
          return this.recordMemory(tool);

        default:
          return {
            tool_use_id: tool.id,
            content: `Unknown tool: ${tool.name}`,
            is_error: true,
          };
      }
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }

  // ==================== TOOL IMPLEMENTATIONS ====================

  /**
   * Query Context Agent for information
   */
  private async queryContextAgent(tool: ToolCall): Promise<ToolResult> {
    const { query, agent_thread_id } = tool.input;

    const result = await contextAgent.search(
      query,
      this.appState.notes,
      this.appState.tasks,
      this.appState.companies,
      this.appState.contacts,
      this.appState.topics,
      agent_thread_id
    );

    // Return FULL data to Claude - let Claude's big context handle it!
    // Includes ALL metadata and relationships (task.context, topics, etc.)
    return {
      tool_use_id: tool.id,
      content: {
        summary: result.summary,
        tasks: result.tasks.map(t => {
          const topic = t.topicId ? this.appState.topics.find(top => top.id === t.topicId) : null;
          const relatedNotes = t.sourceNoteId
            ? this.appState.notes.filter(n => n.id === t.sourceNoteId)
            : [];

          return {
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            done: t.done,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            tags: t.tags,
            sourceNoteId: t.sourceNoteId,
            createdBy: t.createdBy,
            createdAt: t.createdAt,
            topic: topic ? {
              id: topic.id,
              name: topic.name,
            } : null,
            related_notes_summary: relatedNotes.map(n => ({
              id: n.id,
              summary: n.summary,
              timestamp: n.timestamp,
            })),
          };
        }),
        notes: result.notes.map(n => {
          const topic = n.topicId ? this.appState.topics.find(top => top.id === n.topicId) : null;
          const relatedTasks = this.appState.tasks.filter(t =>
            t.sourceNoteId === n.id
          );

          return {
            id: n.id,
            content: n.content,
            summary: n.summary,
            timestamp: n.timestamp,
            lastUpdated: n.lastUpdated,
            source: n.source,
            sourceText: n.sourceText,
            tags: n.tags,
            metadata: n.metadata,
            topic: topic ? {
              id: topic.id,
              name: topic.name,
            } : null,
            related_tasks_count: relatedTasks.length,
          };
        }),
        total_count: {
          tasks: result.tasks.length,
          notes: result.notes.length,
        },
        suggestions: result.suggestions,
        thread_id: result.thread_id,
      },
      // UI also gets full objects for rendering
      full_notes: result.notes,
      full_tasks: result.tasks,
    };
  }

  /**
   * Get current date and time
   */
  private getCurrentDatetime(tool: ToolCall): ToolResult {
    const now = new Date();
    return {
      tool_use_id: tool.id,
      content: {
        datetime: now.toISOString(),
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
        formatted: now.toLocaleString(),
      },
    };
  }

  /**
   * Get current user context
   */
  private getUserContext(tool: ToolCall): ToolResult {
    return {
      tool_use_id: tool.id,
      content: {
        active_tab: this.appState.ui.activeTab,
        active_topic: this.appState.activeTopicId,
        active_note: this.appState.activeNoteId,
        selected_tasks: this.appState.ui.selectedTasks,
        bulk_mode: this.appState.ui.bulkSelectionMode,
        filters: this.appState.ui.preferences.filters,
        user_name: this.appState.userProfile.name,
      },
    };
  }

  /**
   * Recall relevant memories
   */
  private recallMemory(tool: ToolCall): ToolResult {
    const { context } = tool.input;
    const memories = nedMemory.getRelevantMemories(context, 5);

    return {
      tool_use_id: tool.id,
      content: {
        memories: memories.map(m => ({
          id: m.id,
          type: m.type,
          content: m.content,
          relevance: m.relevanceScore,
        })),
        formatted: nedMemory.formatForContext(memories),
      },
    };
  }

  /**
   * Get complete details for a specific task or note
   * Includes ALL metadata, relationships, and context
   */
  private getItemDetails(tool: ToolCall): ToolResult {
    const { item_type, item_id } = tool.input;

    if (item_type === 'task') {
      const task = this.appState.tasks.find(t => t.id === item_id);

      if (!task) {
        return {
          tool_use_id: tool.id,
          content: `Task not found: ${item_id}`,
          is_error: true,
        };
      }

      // Get related notes (from task.sourceNoteId field)
      const relatedNotes = task.sourceNoteId
        ? this.appState.notes.filter(n => n.id === task.sourceNoteId)
        : [];

      // Get topic/company/contact details
      const topic = task.topicId ? this.appState.topics.find(t => t.id === task.topicId) : null;
      const company = task.topicId ? this.appState.companies.find(c => c.id === task.topicId) : null;
      const contact = task.topicId ? this.appState.contacts.find(c => c.id === task.topicId) : null;

      return {
        tool_use_id: tool.id,
        content: {
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            done: task.done,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            tags: task.tags,
            subtasks: task.subtasks,
            createdAt: task.createdAt,
            createdBy: task.createdBy,
            completedAt: task.completedAt,
            sourceNoteId: task.sourceNoteId,
          },
          related_notes: relatedNotes.map(n => ({
            id: n.id,
            content: n.content,
            summary: n.summary,
            timestamp: n.timestamp,
            source: n.source,
            tags: n.tags,
          })),
          topic: topic ? {
            id: topic.id,
            name: topic.name,
          } : null,
          company: company,
          contact: contact,
        },
        // UI also gets full objects for rendering
        full_tasks: [task],
        full_notes: relatedNotes,
      };
    } else {
      // item_type === 'note'
      const note = this.appState.notes.find(n => n.id === item_id);

      if (!note) {
        return {
          tool_use_id: tool.id,
          content: `Note not found: ${item_id}`,
          is_error: true,
        };
      }

      // Get related tasks (tasks that reference this note in their sourceNoteId field)
      const relatedTasks = this.appState.tasks.filter(t =>
        t.sourceNoteId === note.id
      );

      // Get topic/company/contact details
      const topic = note.topicId ? this.appState.topics.find(t => t.id === note.topicId) : null;
      const company = note.topicId ? this.appState.companies.find(c => c.id === note.topicId) : null;
      const contact = note.topicId ? this.appState.contacts.find(c => c.id === note.topicId) : null;

      return {
        tool_use_id: tool.id,
        content: {
          note: {
            id: note.id,
            content: note.content,
            summary: note.summary,
            timestamp: note.timestamp,
            lastUpdated: note.lastUpdated,
            source: note.source,
            sourceText: note.sourceText,
            tags: note.tags,
            metadata: note.metadata,
          },
          related_tasks: relatedTasks.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            status: t.status,
            done: t.done,
          })),
          topic: topic ? {
            id: topic.id,
            name: topic.name,
          } : null,
          company: company,
          contact: contact,
        },
        // UI also gets full objects for rendering
        full_notes: [note],
        full_tasks: relatedTasks,
      };
    }
  }

  /**
   * Create a new task
   */
  private createTask(tool: ToolCall): ToolResult {
    const { title, description, priority, due_date, due_time, tags } = tool.input;

    const newTask = {
      id: generateId(),
      title,
      description,
      priority: priority || 'medium',
      status: 'todo' as const,
      done: false,
      dueDate: due_date,
      dueTime: due_time,
      tags: tags || [],
      createdBy: 'ai' as const,
      createdAt: new Date().toISOString(),
    };

    this.dispatch({ type: 'ADD_TASK', payload: newTask });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        task: newTask,
        message: `Created task: "${title}"`,
      },
    };
  }

  /**
   * Update an existing task
   */
  private updateTask(tool: ToolCall): ToolResult {
    const { task_id, updates } = tool.input;

    const task = this.appState.tasks.find(t => t.id === task_id);
    if (!task) {
      return {
        tool_use_id: tool.id,
        content: `Task not found: ${task_id}`,
        is_error: true,
      };
    }

    const updatedTask = { ...task, ...updates };
    this.dispatch({ type: 'UPDATE_TASK', payload: updatedTask });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        task: updatedTask,
        message: `Updated task: "${task.title}"`,
      },
    };
  }

  /**
   * Mark task as complete
   */
  private completeTask(tool: ToolCall): ToolResult {
    const { task_id } = tool.input;

    const task = this.appState.tasks.find(t => t.id === task_id);
    if (!task) {
      return {
        tool_use_id: tool.id,
        content: `Task not found: ${task_id}`,
        is_error: true,
      };
    }

    this.dispatch({ type: 'TOGGLE_TASK', payload: task_id });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        task_id,
        message: `Completed task: "${task.title}"`,
      },
    };
  }

  /**
   * Delete a task
   */
  private deleteTask(tool: ToolCall): ToolResult {
    const { task_id } = tool.input;

    const task = this.appState.tasks.find(t => t.id === task_id);
    if (!task) {
      return {
        tool_use_id: tool.id,
        content: `Task not found: ${task_id}`,
        is_error: true,
      };
    }

    this.dispatch({ type: 'DELETE_TASK', payload: task_id });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        task_id,
        message: `Deleted task: "${task.title}"`,
      },
    };
  }

  /**
   * Create a new note
   */
  private createNote(tool: ToolCall): ToolResult {
    const { content, topic_id, tags } = tool.input;

    const newNote = {
      id: generateId(),
      content,
      summary: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      topicId: topic_id,
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      source: 'thought' as const,
      tags: tags || [],
    };

    this.dispatch({ type: 'ADD_NOTE', payload: newNote });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        note: newNote,
        message: 'Created note',
      },
    };
  }

  /**
   * Update an existing note
   */
  private updateNote(tool: ToolCall): ToolResult {
    const { note_id, content } = tool.input;

    const note = this.appState.notes.find(n => n.id === note_id);
    if (!note) {
      return {
        tool_use_id: tool.id,
        content: `Note not found: ${note_id}`,
        is_error: true,
      };
    }

    const updatedNote = {
      ...note,
      content,
      summary: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      lastUpdated: new Date().toISOString(),
    };

    this.dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        note: updatedNote,
        message: 'Updated note',
      },
    };
  }

  /**
   * Delete a note
   */
  private deleteNote(tool: ToolCall): ToolResult {
    const { note_id } = tool.input;

    const note = this.appState.notes.find(n => n.id === note_id);
    if (!note) {
      return {
        tool_use_id: tool.id,
        content: `Note not found: ${note_id}`,
        is_error: true,
      };
    }

    this.dispatch({ type: 'DELETE_NOTE', payload: note_id });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        note_id,
        message: 'Deleted note',
      },
    };
  }

  /**
   * Record a memory
   */
  private recordMemory(tool: ToolCall): ToolResult {
    const { memory_type, content } = tool.input;

    const memory = nedMemory.addMemory(memory_type, content);

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        memory,
        message: `Recorded ${memory_type}: "${content}"`,
      },
    };
  }
}
