/**
 * Ned Tool Executor
 *
 * Executes tools called by Ned and returns results.
 * Connects Ned's tool calls to actual app state and actions.
 */

import type { AppState, Session } from '../types';
import { EntityType, RelationshipType } from '../types/relationships';
import type { ToolCall, ToolResult } from './nedTools';
import { contextAgent } from './contextAgent';
import { sessionsQueryAgent } from './sessionsQueryAgent';
import { nedMemory } from './nedMemory';
import { sessionsAgentService } from './sessionsAgentService';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { generateId, stripHtmlTags } from '../utils/helpers';
import {
  getAudioData,
  getVideoData,
  getTranscript,
  getSessionTimeline
} from './ai-tools';
import { AIDeduplicationService } from './aiDeduplication';
import { getStorage } from './storage';

type DispatchFunction = (action: any) => void;

export class NedToolExecutor {
  private appState: AppState;
  private dispatch: DispatchFunction;
  private deduplicationService: AIDeduplicationService;

  constructor(appState: AppState, dispatch: DispatchFunction) {
    this.appState = appState;
    this.dispatch = dispatch;

    // Initialize deduplication service with storage adapter
    // Note: Storage will be initialized asynchronously on first use
    this.deduplicationService = new AIDeduplicationService(getStorage() as any);
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

        // ==================== SESSION TOOLS ====================

        case 'query_sessions':
          return await this.querySessions(tool);

        case 'get_session_details':
          return this.getSessionDetails(tool);

        case 'get_session_summary':
          return await this.getSessionSummary(tool);

        case 'get_active_session':
          return this.getActiveSession(tool);

        case 'get_screenshot_image':
          return await this.getScreenshotImage(tool);

        // ==================== DATA GATHERING TOOLS ====================

        case 'get_audio_data':
          return await this.getAudioData(tool);

        case 'get_video_data':
          return await this.getVideoData(tool);

        case 'get_transcript':
          return await this.getTranscript(tool);

        case 'get_session_timeline':
          return await this.getSessionTimeline(tool);

        // ==================== SEARCH TOOLS ====================

        case 'search_notes':
          return await this.searchNotes(tool);

        case 'search_tasks':
          return await this.searchTasks(tool);

        case 'find_similar_notes':
          return await this.findSimilarNotes(tool);

        case 'find_similar_tasks':
          return await this.findSimilarTasks(tool);

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
          // Get topic from relationships
          const topicRel = t.relationships.find(r => r.targetType === EntityType.TOPIC);
          const topicId = topicRel?.targetId;
          const topic = topicId ? this.appState.topics.find(top => top.id === topicId) : null;

          // Get related notes from relationships
          const noteRelIds = t.relationships
            .filter(r => r.targetType === EntityType.NOTE)
            .map(r => r.targetId);
          const relatedNotes = this.appState.notes.filter(n => noteRelIds.includes(n.id));

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
            sourceNoteId: noteRelIds[0], // First note for backward compat
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
          // Get topic from relationships
          const topicRel = n.relationships.find(r => r.targetType === EntityType.TOPIC);
          const topicId = topicRel?.targetId;
          const topic = topicId ? this.appState.topics.find(top => top.id === topicId) : null;

          // Get related tasks - tasks that have a relationship to this note
          const relatedTasks = this.appState.tasks.filter(t =>
            t.relationships.some(r => r.targetType === EntityType.NOTE && r.targetId === n.id)
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

      // Get related notes from relationships
      const noteRelIds = task.relationships
        .filter(r => r.targetType === EntityType.NOTE)
        .map(r => r.targetId);
      const relatedNotes = this.appState.notes.filter(n => noteRelIds.includes(n.id));

      // Get topic/company/contact details from relationships
      const topicRel = task.relationships.find(r => r.targetType === EntityType.TOPIC);
      const topicId = topicRel?.targetId;
      const topic = topicId ? this.appState.topics.find(t => t.id === topicId) : null;

      const companyRel = task.relationships.find(r => r.targetType === EntityType.COMPANY);
      const companyId = companyRel?.targetId;
      const company = companyId ? this.appState.companies.find(c => c.id === companyId) : null;

      const contactRel = task.relationships.find(r => r.targetType === EntityType.CONTACT);
      const contactId = contactRel?.targetId;
      const contact = contactId ? this.appState.contacts.find(c => c.id === contactId) : null;

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
            sourceNoteId: noteRelIds[0], // First note for backward compat
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

      // Get related tasks - tasks that have a relationship to this note
      const relatedTasks = this.appState.tasks.filter(t =>
        t.relationships.some(r => r.targetType === EntityType.NOTE && r.targetId === note.id)
      );

      // Get topic/company/contact details from relationships
      const topicRel = note.relationships.find(r => r.targetType === EntityType.TOPIC);
      const topicId = topicRel?.targetId;
      const topic = topicId ? this.appState.topics.find(t => t.id === topicId) : null;

      const companyRel = note.relationships.find(r => r.targetType === EntityType.COMPANY);
      const companyId = companyRel?.targetId;
      const company = companyId ? this.appState.companies.find(c => c.id === companyId) : null;

      const contactRel = note.relationships.find(r => r.targetType === EntityType.CONTACT);
      const contactId = contactRel?.targetId;
      const contact = contactId ? this.appState.contacts.find(c => c.id === contactId) : null;

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
      relationships: [],
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
      // Change tracking data for UI
      operation: 'create',
      item_type: 'task',
      item: newTask,
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

    // Track changes
    const changes = [];
    const fieldLabels: Record<string, string> = {
      title: 'Title',
      description: 'Description',
      priority: 'Priority',
      status: 'Status',
      dueDate: 'Due Date',
      dueTime: 'Due Time',
      done: 'Completed',
      tags: 'Tags',
    };

    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = (task as any)[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field,
          label: fieldLabels[field] || field,
          oldValue,
          newValue,
        });
      }
    }

    const updatedTask = { ...task, ...updates };
    this.dispatch({ type: 'UPDATE_TASK', payload: updatedTask });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        task: updatedTask,
        message: `Updated task: "${task.title}"`,
        changes,
      },
      // Change tracking data for UI
      operation: 'update',
      item_type: 'task',
      item: updatedTask,
      changes,
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

    // Strip any HTML tags from AI-generated content to ensure clean markdown/plain text
    const cleanContent = stripHtmlTags(content);

    const noteId = generateId();
    const now = new Date().toISOString();

    const newNote = {
      id: noteId,
      relationships: topic_id ? [
        {
          id: generateId(),
          sourceType: EntityType.NOTE,
          sourceId: noteId,
          targetType: EntityType.TOPIC,
          targetId: topic_id,
          type: RelationshipType.NOTE_TOPIC,
          canonical: true,
          metadata: { source: 'ai' as const, createdAt: now },
        },
      ] : [],
      content: cleanContent,
      summary: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
      timestamp: now,
      lastUpdated: now,
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
      // Change tracking data for UI
      operation: 'create',
      item_type: 'note',
      item: newNote,
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

    // Strip any HTML tags from AI-generated content to ensure clean markdown/plain text
    const cleanContent = stripHtmlTags(content);

    // Track changes
    const changes = [];
    if (note.content !== cleanContent) {
      changes.push({
        field: 'content',
        label: 'Content',
        oldValue: note.content,
        newValue: cleanContent,
      });
    }

    const updatedNote = {
      ...note,
      content: cleanContent,
      summary: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
      lastUpdated: new Date().toISOString(),
    };

    this.dispatch({ type: 'UPDATE_NOTE', payload: updatedNote });

    return {
      tool_use_id: tool.id,
      content: {
        success: true,
        note: updatedNote,
        message: 'Updated note',
        changes,
      },
      // Change tracking data for UI
      operation: 'update',
      item_type: 'note',
      item: updatedNote,
      changes,
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

  // ==================== SEARCH TOOL IMPLEMENTATIONS ====================

  /**
   * Search notes using QueryEngine with filters
   */
  private async searchNotes(tool: ToolCall): Promise<ToolResult> {
    const { query, topicId, tags, dateRange, limit = 20 } = tool.input;

    try {
      // Use UnifiedIndexManager for O(log n) search (was O(n) linear filtering)
      const { getUnifiedIndexManager } = await import('./storage/UnifiedIndexManager');
      const unifiedIndex = await getUnifiedIndexManager();

      // Build unified query
      const searchQuery: any = {
        entityTypes: ['notes'],
        limit,
      };

      if (query) {
        searchQuery.query = query;
      }

      if (topicId) {
        searchQuery.relatedTo = {
          entityType: 'topic',
          entityId: topicId,
        };
      }

      if (tags || dateRange) {
        searchQuery.filters = {};
        if (tags && tags.length > 0) {
          searchQuery.filters.tags = tags;
        }
        if (dateRange) {
          searchQuery.timeRange = {
            start: dateRange.start,
            end: dateRange.end,
          };
        }
      }

      // Execute search (O(log n) via inverted indexes)
      const searchResult = await unifiedIndex.unifiedSearch(searchQuery);
      const noteIds = searchResult.results.notes.map(r => r.id);

      // Load full notes from appState
      const results = this.appState.notes.filter((n: any) => noteIds.includes(n.id));

      return {
        tool_use_id: tool.id,
        content: {
          notes: results.map((n: any) => ({
            id: n.id,
            summary: n.summary,
            content: n.content?.substring(0, 200) + (n.content?.length > 200 ? '...' : ''),
            timestamp: n.timestamp,
            tags: n.tags || [],
            source: n.source,
          })),
          total: results.length,
          query_used: query || 'none',
          search_time_ms: searchResult.took,
        },
        full_notes: results, // For UI rendering
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Error searching notes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        is_error: true,
      };
    }
  }

  /**
   * Search tasks using UnifiedIndexManager with O(log n) performance
   */
  private async searchTasks(tool: ToolCall): Promise<ToolResult> {
    const { query, status, priority, dateRange, limit = 20 } = tool.input;

    try {
      // Use UnifiedIndexManager for O(log n) search (was O(n) linear filtering)
      const { getUnifiedIndexManager } = await import('./storage/UnifiedIndexManager');
      const unifiedIndex = await getUnifiedIndexManager();

      // Build unified query
      const searchQuery: any = {
        entityTypes: ['tasks'],
        limit,
      };

      if (query) {
        searchQuery.query = query;
      }

      if (status || priority || dateRange) {
        searchQuery.filters = {};
        if (status && status.length > 0) {
          searchQuery.filters.status = status;
        }
        if (priority && priority.length > 0) {
          searchQuery.filters.priority = priority;
        }
      }

      if (dateRange) {
        searchQuery.timeRange = {
          start: dateRange.start,
          end: dateRange.end,
        };
      }

      // Execute search (O(log n) via inverted indexes)
      const searchResult = await unifiedIndex.unifiedSearch(searchQuery);
      const taskIds = searchResult.results.tasks.map(r => r.id);

      // Load full tasks from appState
      const results = this.appState.tasks.filter((t: any) => taskIds.includes(t.id));

      return {
        tool_use_id: tool.id,
        content: {
          tasks: results.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            done: t.done,
            createdAt: t.createdAt,
          })),
          total: results.length,
          query_used: query || 'none',
          search_time_ms: searchResult.took,
        },
        full_tasks: results, // For UI rendering
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Error searching tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        is_error: true,
      };
    }
  }

  /**
   * Find notes similar to given content (for duplicate detection)
   *
   * Uses AIDeduplicationService for semantic similarity detection with
   * Levenshtein distance and context-aware matching.
   */
  private async findSimilarNotes(tool: ToolCall): Promise<ToolResult> {
    const { summary, content, topicId, minSimilarity = 0.7 } = tool.input;

    try {
      // Use AIDeduplicationService for proper semantic similarity
      const similarResults = await this.deduplicationService.findSimilarNotes({
        summary,
        content,
        topicId,
        minSimilarity,
        maxResults: 10,
      });

      // Transform results to match expected tool output format
      const similar = similarResults.map(result => ({
        note: result.entity,
        similarity: result.similarity,
        confidence: result.confidence,
        shouldMerge: result.shouldMerge,
        reason: result.reason,
      }));

      return {
        tool_use_id: tool.id,
        content: {
          similar: similar.map(s => ({
            note: {
              id: s.note.id,
              summary: s.note.summary,
              content: s.note.content?.substring(0, 200),
              timestamp: s.note.timestamp,
            },
            similarity: s.similarity,
            confidence: s.confidence,
            shouldMerge: s.shouldMerge,
            reason: s.reason,
          })),
          total: similar.length,
          threshold: minSimilarity,
        },
        full_notes: similar.map(s => s.note), // For UI rendering
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Error finding similar notes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        is_error: true,
      };
    }
  }

  /**
   * Find tasks similar to given title (for duplicate detection)
   *
   * Uses AIDeduplicationService for semantic similarity detection with
   * Levenshtein distance and context-aware matching.
   */
  private async findSimilarTasks(tool: ToolCall): Promise<ToolResult> {
    const { title, description, contextNoteId, minSimilarity = 0.8 } = tool.input;

    try {
      // Use AIDeduplicationService for proper semantic similarity
      const similarResults = await this.deduplicationService.findSimilarTasks({
        title,
        description,
        contextNoteId,
        minSimilarity,
        maxResults: 10,
      });

      // Transform results to match expected tool output format
      const similar = similarResults.map(result => ({
        task: result.entity,
        similarity: result.similarity,
        confidence: result.confidence,
        shouldMerge: result.shouldMerge,
        reason: result.reason,
      }));

      return {
        tool_use_id: tool.id,
        content: {
          similar: similar.map(s => ({
            task: {
              id: s.task.id,
              title: s.task.title,
              description: s.task.description,
              status: s.task.status,
              done: s.task.done,
            },
            similarity: s.similarity,
            confidence: s.confidence,
            shouldMerge: s.shouldMerge,
            reason: s.reason,
          })),
          total: similar.length,
          threshold: minSimilarity,
        },
        full_tasks: similar.map(s => s.task), // For UI rendering
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Error finding similar tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        is_error: true,
      };
    }
  }

  // ==================== SESSION TOOL IMPLEMENTATIONS ====================

  /**
   * Query sessions using AI agent for semantic search
   */
  private async querySessions(tool: ToolCall): Promise<ToolResult> {
    const { query, agent_thread_id } = tool.input;

    try {
      // Use Sessions Query Agent for intelligent search
      const result = await sessionsQueryAgent.search(
        query,
        this.appState.sessions,
        agent_thread_id
      );

      // Format session data for Ned
      const sessionData = result.sessions.map(s => {
        const audioSegments = s.audioSegments || [];

        // Combine transcriptions (first 200 chars)
        const transcriptionPreview = audioSegments
          .map(seg => seg.transcription)
          .join(' ')
          .substring(0, 200);

        // Get key phrases
        const audioKeyPhrases = audioSegments
          .flatMap(seg => seg.keyPhrases || [])
          .slice(0, 5);

        return {
          id: s.id,
          name: s.name,
          description: s.description,
          status: s.status,
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.totalDuration || this.calculateSessionDuration(s),
          screenshotCount: s.screenshots.length,
          audioSegmentCount: audioSegments.length,
          // extractedTaskCount/extractedNoteCount removed - now tracked via relationships
          extractedTaskCount: 0,
          extractedNoteCount: 0,
          tags: s.tags,
          activityType: s.activityType,
          // Include summary of screenshot activities for context
          recentActivities: s.screenshots
            .filter(ss => ss.aiAnalysis?.detectedActivity)
            .slice(-3)
            .map(ss => ss.aiAnalysis!.detectedActivity),
          // Include audio transcription preview
          audioTranscriptionPreview: transcriptionPreview || undefined,
          audioKeyPhrases: audioKeyPhrases.length > 0 ? audioKeyPhrases : undefined,
          audioTasksDetected: audioSegments.filter(seg => seg.containsTask).length,
          audioBlockersDetected: audioSegments.filter(seg => seg.containsBlocker).length,
        };
      });

      return {
        tool_use_id: tool.id,
        content: {
          summary: result.summary,
          sessions: sessionData,
          total_found: result.sessions.length,
          suggestions: result.suggestions,
          thread_id: result.thread_id,
        },
        // UI also gets full session objects for rendering
        full_sessions: result.sessions,
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Failed to search sessions: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }

  /**
   * Get complete details for a specific session
   */
  private getSessionDetails(tool: ToolCall): ToolResult {
    const { session_id } = tool.input;

    const session = this.appState.sessions.find(s => s.id === session_id);

    if (!session) {
      return {
        tool_use_id: tool.id,
        content: `Session not found: ${session_id}`,
        is_error: true,
      };
    }

    // Get extracted tasks - tasks that have a relationship to this session
    const extractedTasks = this.appState.tasks.filter((t: any) =>
      t.relationships?.some((r: any) => r.targetType === EntityType.SESSION && r.targetId === session.id)
    );

    // Get extracted notes - notes that have a relationship to this session
    const extractedNotes = this.appState.notes.filter((n: any) =>
      n.relationships?.some((r: any) => r.targetType === EntityType.SESSION && r.targetId === session.id)
    );

    // Format screenshots with analysis
    const screenshots = session.screenshots.map(ss => ({
      id: ss.id,
      timestamp: ss.timestamp,
      analysisStatus: ss.analysisStatus,
      aiAnalysis: ss.aiAnalysis,
      userComment: ss.userComment,
      flagged: ss.flagged,
    }));

    // Format audio segments with transcriptions
    const audioSegments = (session.audioSegments || []).map(seg => ({
      id: seg.id,
      timestamp: seg.timestamp,
      duration: seg.duration,
      transcription: seg.transcription,
      description: seg.description,
      mode: seg.mode,
      keyPhrases: seg.keyPhrases,
      sentiment: seg.sentiment,
      containsTask: seg.containsTask,
      containsBlocker: seg.containsBlocker,
    }));

    return {
      tool_use_id: tool.id,
      content: {
        session: {
          id: session.id,
          name: session.name,
          description: session.description,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.totalDuration || this.calculateSessionDuration(session),
          screenshotInterval: session.screenshotInterval,
          autoAnalysis: session.autoAnalysis,
          audioMode: session.audioMode,
          tags: session.tags,
          activityType: session.activityType,
        },
        screenshots,
        audioSegments,
        extractedTasks: extractedTasks.map(t => ({
          id: t!.id,
          title: t!.title,
          priority: t!.priority,
          status: t!.status,
        })),
        extractedNotes: extractedNotes.map(n => ({
          id: n!.id,
          summary: n!.summary,
          timestamp: n!.timestamp,
        })),
        stats: {
          screenshotCount: screenshots.length,
          audioSegmentCount: audioSegments.length,
          taskCount: extractedTasks.length,
          noteCount: extractedNotes.length,
          duration: session.totalDuration || this.calculateSessionDuration(session),
        },
      },
    };
  }

  /**
   * Generate AI-powered session summary
   */
  private async getSessionSummary(tool: ToolCall): Promise<ToolResult> {
    const { session_id } = tool.input;

    const session = this.appState.sessions.find(s => s.id === session_id);

    if (!session) {
      return {
        tool_use_id: tool.id,
        content: `Session not found: ${session_id}`,
        is_error: true,
      };
    }

    try {
      // Gather context from existing sessions and notes for categorization
      const existingCategories = Array.from(new Set(this.appState.sessions.map(s => s.category).filter(Boolean))) as string[];
      const existingSubCategories = Array.from(new Set(this.appState.sessions.map(s => s.subCategory).filter(Boolean))) as string[];
      const existingTags = Array.from(
        new Set([
          ...this.appState.sessions.flatMap(s => s.tags || []),
          ...this.appState.notes.flatMap(n => n.tags || [])
        ])
      );

      // Generate summary using SessionsAgentService
      const summary = await sessionsAgentService.generateSessionSummary(
        session,
        session.screenshots,
        session.audioSegments || [],
        {
          existingCategories,
          existingSubCategories,
          existingTags
        }
      );

      return {
        tool_use_id: tool.id,
        content: {
          narrative: summary.narrative || '',
          achievements: summary.achievements || [],
          blockers: summary.blockers || [],
          recommendedTasks: summary.recommendedTasks || [],
          keyInsights: summary.keyInsights || [],
          focusAreas: summary.focusAreas || [],
          category: summary.category,
          subCategory: summary.subCategory,
          tags: summary.tags,
          sessionName: session.name,
          duration: this.calculateSessionDuration(session),
        },
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }

  /**
   * Get currently active session
   */
  private getActiveSession(tool: ToolCall): ToolResult {
    const activeSession = this.appState.sessions.find(
      s => s.id === this.appState.activeSessionId
    );

    if (!activeSession) {
      return {
        tool_use_id: tool.id,
        content: {
          hasActiveSession: false,
          message: 'No active session',
        },
      };
    }

    return {
      tool_use_id: tool.id,
      content: {
        hasActiveSession: true,
        session: {
          id: activeSession.id,
          name: activeSession.name,
          description: activeSession.description,
          status: activeSession.status,
          startTime: activeSession.startTime,
          duration: this.calculateSessionDuration(activeSession),
          screenshotCount: activeSession.screenshots.length,
          audioSegmentCount: (activeSession.audioSegments || []).length,
          audioMode: activeSession.audioMode,
          tags: activeSession.tags,
          activityType: activeSession.activityType,
        },
      },
    };
  }

  /**
   * Get screenshot image for visual analysis
   * EXPENSIVE - loads full screenshot image data
   */
  private async getScreenshotImage(tool: ToolCall): Promise<ToolResult> {
    const { screenshot_id, reason } = tool.input;

    // Log usage for tracking
    console.log(`📸 Ned viewing screenshot: ${screenshot_id} | Reason: ${reason}`);

    // Find the screenshot across all sessions
    let screenshot = null;
    let session = null;

    for (const s of this.appState.sessions) {
      const found = s.screenshots.find(ss => ss.id === screenshot_id);
      if (found) {
        screenshot = found;
        session = s;
        break;
      }
    }

    if (!screenshot || !session) {
      return {
        tool_use_id: tool.id,
        content: `Screenshot not found: ${screenshot_id}`,
        is_error: true,
      };
    }

    try {
      // Load the attachment containing the screenshot (Phase 4: Use hash if available)
      const caStorage = await getCAStorage();
      const identifier = screenshot.hash || screenshot.attachmentId;
      const attachment = await caStorage.loadAttachment(identifier);

      if (!attachment || !attachment.base64) {
        return {
          tool_use_id: tool.id,
          content: `Screenshot image data not found for: ${screenshot_id}`,
          is_error: true,
        };
      }

      // Return the screenshot with full visual data
      return {
        tool_use_id: tool.id,
        content: {
          screenshot: {
            id: screenshot.id,
            timestamp: screenshot.timestamp,
            sessionId: session.id,
            sessionName: session.name,
            analysisStatus: screenshot.analysisStatus,
            aiAnalysis: screenshot.aiAnalysis,
            userComment: screenshot.userComment,
            flagged: screenshot.flagged,
          },
          image: {
            source: {
              type: 'base64',
              media_type: attachment.mimeType || 'image/jpeg',
              data: attachment.base64,
            },
          },
          context: {
            reason_for_viewing: reason,
            session_context: `Part of session "${session.name}" started at ${new Date(session.startTime).toLocaleString()}`,
            screenshot_number: session.screenshots.findIndex(ss => ss.id === screenshot_id) + 1,
            total_screenshots: session.screenshots.length,
          },
        },
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Failed to load screenshot image: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }

  /**
   * Helper: Calculate session duration (excluding pause time)
   */
  private calculateSessionDuration(session: Session): number {
    if (!session.startTime) return 0;

    const startMs = new Date(session.startTime).getTime();
    const endMs = session.endTime ? new Date(session.endTime).getTime() : new Date().getTime();
    let totalPausedMs = session.totalPausedTime || 0;

    // If currently paused, add current pause duration
    if (session.status === 'paused' && session.pausedAt) {
      const currentPauseDuration = new Date().getTime() - new Date(session.pausedAt).getTime();
      totalPausedMs += currentPauseDuration;
    }

    // Calculate active duration: (end - start - total paused time) in minutes
    const activeMs = endMs - startMs - totalPausedMs;
    return Math.floor(activeMs / (1000 * 60));
  }


  // ==================== DATA GATHERING TOOL HANDLERS ====================

  /**
   * Get audio data from a session
   */
  private async getAudioData(tool: ToolCall): Promise<ToolResult> {
    const result = await getAudioData(tool.input as any);

    if (!result.success) {
      return {
        tool_use_id: tool.id,
        content: result.error?.userMessage || 'Failed to retrieve audio data',
        is_error: true,
      };
    }

    return {
      tool_use_id: tool.id,
      content: JSON.stringify(result.data, null, 2),
    };
  }

  /**
   * Get video data from a session
   */
  private async getVideoData(tool: ToolCall): Promise<ToolResult> {
    const result = await getVideoData(tool.input as any);

    if (!result.success) {
      return {
        tool_use_id: tool.id,
        content: result.error?.userMessage || 'Failed to retrieve video data',
        is_error: true,
      };
    }

    return {
      tool_use_id: tool.id,
      content: JSON.stringify(result.data, null, 2),
    };
  }

  /**
   * Get transcript from a session
   */
  private async getTranscript(tool: ToolCall): Promise<ToolResult> {
    const result = await getTranscript(tool.input as any);

    if (!result.success) {
      return {
        tool_use_id: tool.id,
        content: result.error?.userMessage || 'Failed to retrieve transcript',
        is_error: true,
      };
    }

    return {
      tool_use_id: tool.id,
      content: JSON.stringify(result.data, null, 2),
    };
  }

  /**
   * Get session timeline
   */
  private async getSessionTimeline(tool: ToolCall): Promise<ToolResult> {
    const result = await getSessionTimeline(tool.input as any);

    if (!result.success) {
      return {
        tool_use_id: tool.id,
        content: result.error?.userMessage || 'Failed to build session timeline',
        is_error: true,
      };
    }

    return {
      tool_use_id: tool.id,
      content: JSON.stringify(result.data, null, 2),
    };
  }
}
