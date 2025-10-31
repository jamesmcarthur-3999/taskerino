/**
 * Ned Tool Executor
 *
 * Executes tools called by Ned and returns results.
 * Connects Ned's tool calls to actual app state and actions.
 */

import type { AppState, Session } from '../types';
import type { ToolCall, ToolResult } from './nedToolsZod';
import { contextAgent } from './contextAgent';
import { sessionsQueryAgent } from './sessionsQueryAgent';
import { nedMemory } from './nedMemory';
import { sessionsAgentService } from './sessionsAgentService';
import { getCAStorage } from './storage/ContentAddressableStorage';
import { generateId, stripHtmlTags } from '../utils/helpers';
import { relationshipManager } from './relationshipManager';
import { EntityType, RelationshipType } from '../types/relationships';

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

        case 'get_entity_relationships':
          return await this.getEntityRelationships(tool);

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

        case 'link_entities':
          return await this.linkEntities(tool);

        case 'unlink_entities':
          return await this.unlinkEntities(tool);

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

    const newNote = {
      id: generateId(),
      content: cleanContent,
      summary: cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : ''),
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
          extractedTaskCount: s.extractedTaskIds.length,
          extractedNoteCount: s.extractedNoteIds.length,
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

    // Get extracted tasks
    const extractedTasks = session.extractedTaskIds
      .map(taskId => this.appState.tasks.find(t => t.id === taskId))
      .filter(Boolean);

    // Get extracted notes
    const extractedNotes = session.extractedNoteIds
      .map(noteId => this.appState.notes.find(n => n.id === noteId))
      .filter(Boolean);

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

  // ==================== RELATIONSHIP TOOLS ====================

  /**
   * Link entities to a note or task (creates relationships)
   */
  private async linkEntities(tool: ToolCall): Promise<ToolResult> {
    const { item_type, item_id, company_ids, contact_ids, topic_ids } = tool.input;

    // Verify item exists
    const items = item_type === 'task' ? this.appState.tasks : this.appState.notes;
    const item = items.find((i: any) => i.id === item_id);

    if (!item) {
      return {
        tool_use_id: tool.id,
        content: `${item_type} not found: ${item_id}`,
        is_error: true,
      };
    }

    try {
      await relationshipManager.init();

      const createdRelationships = [];
      const sourceType = item_type === 'task' ? EntityType.TASK : EntityType.NOTE;

      // Link companies
      if (company_ids && company_ids.length > 0) {
        for (const companyId of company_ids) {
          const relationship = await relationshipManager.addRelationship({
            sourceType,
            sourceId: item_id,
            targetType: EntityType.COMPANY,
            targetId: companyId,
            type: item_type === 'task' ? RelationshipType.TASK_COMPANY : RelationshipType.NOTE_COMPANY,
            metadata: {
              source: 'ai',
              createdBy: 'ned',
              createdAt: new Date().toISOString(),
            },
          });
          createdRelationships.push(relationship);
        }
      }

      // Link contacts
      if (contact_ids && contact_ids.length > 0) {
        for (const contactId of contact_ids) {
          const relationship = await relationshipManager.addRelationship({
            sourceType,
            sourceId: item_id,
            targetType: EntityType.CONTACT,
            targetId: contactId,
            type: item_type === 'task' ? RelationshipType.TASK_CONTACT : RelationshipType.NOTE_CONTACT,
            metadata: {
              source: 'ai',
              createdBy: 'ned',
              createdAt: new Date().toISOString(),
            },
          });
          createdRelationships.push(relationship);
        }
      }

      // Link topics
      if (topic_ids && topic_ids.length > 0) {
        for (const topicId of topic_ids) {
          const relationship = await relationshipManager.addRelationship({
            sourceType,
            sourceId: item_id,
            targetType: EntityType.TOPIC,
            targetId: topicId,
            type: item_type === 'task' ? RelationshipType.TASK_TOPIC : RelationshipType.NOTE_TOPIC,
            metadata: {
              source: 'ai',
              createdBy: 'ned',
              createdAt: new Date().toISOString(),
            },
          });
          createdRelationships.push(relationship);
        }
      }

      return {
        tool_use_id: tool.id,
        content: {
          success: true,
          message: `Linked ${createdRelationships.length} entities to ${item_type} "${(item as any).title || (item as any).summary}"`,
          relationships: createdRelationships,
          item_id,
          item_type,
        },
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Failed to link entities: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }

  /**
   * Unlink entities from a note or task (removes relationships)
   */
  private async unlinkEntities(tool: ToolCall): Promise<ToolResult> {
    const { item_type, item_id, company_ids, contact_ids, topic_ids } = tool.input;

    // Verify item exists
    const items = item_type === 'task' ? this.appState.tasks : this.appState.notes;
    const item = items.find((i: any) => i.id === item_id);

    if (!item) {
      return {
        tool_use_id: tool.id,
        content: `${item_type} not found: ${item_id}`,
        is_error: true,
      };
    }

    try {
      await relationshipManager.init();

      const removedCount = [];
      const sourceType = item_type === 'task' ? EntityType.TASK : EntityType.NOTE;

      // Get all current relationships
      const allRelationships = relationshipManager.getRelationships({ entityId: item_id });

      // Remove companies
      if (company_ids && company_ids.length > 0) {
        for (const companyId of company_ids) {
          const rel = allRelationships.find(
            r => r.targetType === EntityType.COMPANY && r.targetId === companyId
          );
          if (rel) {
            await relationshipManager.removeRelationship({ relationshipId: rel.id });
            removedCount.push(rel);
          }
        }
      }

      // Remove contacts
      if (contact_ids && contact_ids.length > 0) {
        for (const contactId of contact_ids) {
          const rel = allRelationships.find(
            r => r.targetType === EntityType.CONTACT && r.targetId === contactId
          );
          if (rel) {
            await relationshipManager.removeRelationship({ relationshipId: rel.id });
            removedCount.push(rel);
          }
        }
      }

      // Remove topics
      if (topic_ids && topic_ids.length > 0) {
        for (const topicId of topic_ids) {
          const rel = allRelationships.find(
            r => r.targetType === EntityType.TOPIC && r.targetId === topicId
          );
          if (rel) {
            await relationshipManager.removeRelationship({ relationshipId: rel.id });
            removedCount.push(rel);
          }
        }
      }

      return {
        tool_use_id: tool.id,
        content: {
          success: true,
          message: `Removed ${removedCount.length} entity links from ${item_type} "${(item as any).title || (item as any).summary}"`,
          removed_count: removedCount.length,
          item_id,
          item_type,
        },
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Failed to unlink entities: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }

  /**
   * Get entity relationships
   */
  private async getEntityRelationships(tool: ToolCall): Promise<ToolResult> {
    const { entity_type, entity_id } = tool.input;

    // Verify entity exists
    let entityExists = false;
    let entityName = '';

    switch (entity_type) {
      case 'task':
        const task = this.appState.tasks.find(t => t.id === entity_id);
        if (task) {
          entityExists = true;
          entityName = task.title;
        }
        break;
      case 'note':
        const note = this.appState.notes.find(n => n.id === entity_id);
        if (note) {
          entityExists = true;
          entityName = note.summary;
        }
        break;
      case 'company':
        const company = this.appState.companies.find(c => c.id === entity_id);
        if (company) {
          entityExists = true;
          entityName = company.name;
        }
        break;
      case 'contact':
        const contact = this.appState.contacts.find(c => c.id === entity_id);
        if (contact) {
          entityExists = true;
          entityName = contact.name;
        }
        break;
      case 'topic':
        const topic = this.appState.topics.find(t => t.id === entity_id);
        if (topic) {
          entityExists = true;
          entityName = topic.name;
        }
        break;
      case 'session':
        const session = this.appState.sessions.find(s => s.id === entity_id);
        if (session) {
          entityExists = true;
          entityName = session.name;
        }
        break;
    }

    if (!entityExists) {
      return {
        tool_use_id: tool.id,
        content: `${entity_type} not found: ${entity_id}`,
        is_error: true,
      };
    }

    try {
      await relationshipManager.init();

      const relationships = relationshipManager.getRelationships({ entityId: entity_id });

      // Enrich relationships with entity names
      const enrichedRelationships = relationships.map(rel => {
        let targetName = '';
        let sourceName = '';

        // Get target name
        if (rel.targetId !== entity_id) {
          switch (rel.targetType) {
            case EntityType.TASK:
              targetName = this.appState.tasks.find(t => t.id === rel.targetId)?.title || '';
              break;
            case EntityType.NOTE:
              targetName = this.appState.notes.find(n => n.id === rel.targetId)?.summary || '';
              break;
            case EntityType.COMPANY:
              targetName = this.appState.companies.find(c => c.id === rel.targetId)?.name || '';
              break;
            case EntityType.CONTACT:
              targetName = this.appState.contacts.find(c => c.id === rel.targetId)?.name || '';
              break;
            case EntityType.TOPIC:
              targetName = this.appState.topics.find(t => t.id === rel.targetId)?.name || '';
              break;
            case EntityType.SESSION:
              targetName = this.appState.sessions.find(s => s.id === rel.targetId)?.name || '';
              break;
          }
        }

        // Get source name
        if (rel.sourceId !== entity_id) {
          switch (rel.sourceType) {
            case EntityType.TASK:
              sourceName = this.appState.tasks.find(t => t.id === rel.sourceId)?.title || '';
              break;
            case EntityType.NOTE:
              sourceName = this.appState.notes.find(n => n.id === rel.sourceId)?.summary || '';
              break;
            case EntityType.COMPANY:
              sourceName = this.appState.companies.find(c => c.id === rel.sourceId)?.name || '';
              break;
            case EntityType.CONTACT:
              sourceName = this.appState.contacts.find(c => c.id === rel.sourceId)?.name || '';
              break;
            case EntityType.TOPIC:
              sourceName = this.appState.topics.find(t => t.id === rel.sourceId)?.name || '';
              break;
            case EntityType.SESSION:
              sourceName = this.appState.sessions.find(s => s.id === rel.sourceId)?.name || '';
              break;
          }
        }

        return {
          ...rel,
          targetName: targetName || rel.targetId,
          sourceName: sourceName || rel.sourceId,
        };
      });

      return {
        tool_use_id: tool.id,
        content: {
          entity_type,
          entity_id,
          entity_name: entityName,
          relationships: enrichedRelationships,
          total_relationships: enrichedRelationships.length,
          summary: `Found ${enrichedRelationships.length} relationships for ${entity_type} "${entityName}"`,
        },
      };
    } catch (error) {
      return {
        tool_use_id: tool.id,
        content: `Failed to get relationships: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true,
      };
    }
  }
}
