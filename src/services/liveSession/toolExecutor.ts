/**
 * Live Session Tool Executor
 *
 * Executes tool calls from external AI services against Taskerino's APIs.
 * Provides a unified interface for all live session tools.
 *
 * Usage:
 * ```typescript
 * const executor = new LiveSessionToolExecutor(activeSession);
 *
 * const results = await executor.executeTools([
 *   { id: '1', name: 'universal_search', input: { query: 'authentication' } },
 *   { id: '2', name: 'get_progress_indicators', input: {} }
 * ]);
 * ```
 */

import type { Session } from '../../types';
import { getUnifiedIndexManager } from '../storage/UnifiedIndexManager';
import { LiveSessionContextProvider } from '../LiveSessionContextProvider';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool call from AI service
 */
export interface ToolCall {
  id: string;           // Unique ID for this tool call
  name: string;         // Tool name (from LIVE_SESSION_TOOLS)
  input: Record<string, any>;  // Tool input parameters
}

/**
 * Tool execution result
 */
export interface ToolResult {
  tool_use_id: string;  // Matches ToolCall.id
  content: any;         // Tool output (structured data)
  error?: string;       // Error message if execution failed
}

/**
 * Progress indicators aggregation
 */
export interface ProgressIndicators {
  achievements: string[];
  blockers: string[];
  insights: string[];
}

/**
 * Timeline item (screenshot or audio segment)
 */
export interface TimelineItem {
  id: string;
  type: 'screenshot' | 'audio';
  timestamp: string;
  data: any;  // SessionScreenshot or SessionAudioSegment
}

/**
 * Task suggestion from AI
 */
export interface TaskSuggestion {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  dueTime?: string;
  tags?: string[];
  topicId?: string;
  noteId?: string;
  context?: string;  // Why this task is suggested
}

/**
 * Note suggestion from AI
 */
export interface NoteSuggestion {
  content: string;
  topicId?: string;
  tags?: string[];
  companyIds?: string[];
  contactIds?: string[];
  context?: string;  // Why this note is suggested
}

// ============================================================================
// LiveSessionToolExecutor
// ============================================================================

export class LiveSessionToolExecutor {
  private session: Session | null;
  private contextProvider: LiveSessionContextProvider | null;

  constructor(session?: Session) {
    this.session = session || null;
    this.contextProvider = session ? new LiveSessionContextProvider(session) : null;
  }

  /**
   * Set the active session (for context-dependent tools)
   */
  setActiveSession(session: Session | null): void {
    this.session = session;
    this.contextProvider = session ? new LiveSessionContextProvider(session) : null;
  }

  /**
   * Execute multiple tool calls in parallel
   *
   * @param toolCalls - Array of tool calls from AI
   * @returns Array of tool results (same order as input)
   */
  async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    // Execute all tools in parallel
    const promises = toolCalls.map(toolCall => this.executeTool(toolCall));
    return await Promise.all(promises);
  }

  /**
   * Execute a single tool call
   *
   * @param toolCall - Tool call from AI
   * @returns Tool result with output or error
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      let content: any;

      switch (toolCall.name) {
        // Entity search tools
        case 'universal_search':
          content = await this.executeUniversalSearch(toolCall.input);
          break;

        // Session query tools
        case 'search_session_screenshots':
          content = await this.executeSearchScreenshots(toolCall.input);
          break;

        case 'search_session_audio':
          content = await this.executeSearchAudio(toolCall.input);
          break;

        case 'get_progress_indicators':
          content = await this.executeGetProgressIndicators(toolCall.input);
          break;

        case 'get_recent_activity':
          content = await this.executeGetRecentActivity(toolCall.input);
          break;

        // Task/note creation tools
        case 'create_task':
          content = await this.executeCreateTask(toolCall.input);
          break;

        case 'create_note':
          content = await this.executeCreateNote(toolCall.input);
          break;

        // User interaction tools
        case 'ask_user_question':
          content = await this.executeAskUserQuestion(toolCall.input);
          break;

        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }

      return {
        tool_use_id: toolCall.id,
        content
      };
    } catch (error: any) {
      console.error(`[LiveSessionToolExecutor] Tool execution failed: ${toolCall.name}`, error);
      return {
        tool_use_id: toolCall.id,
        content: null,
        error: error.message || 'Tool execution failed'
      };
    }
  }

  // ==========================================================================
  // Entity Search Tools
  // ==========================================================================

  /**
   * Execute universal_search tool
   *
   * Searches across all entities (sessions, notes, tasks) using UnifiedIndexManager
   */
  private async executeUniversalSearch(input: any) {
    const indexManager = await getUnifiedIndexManager();

    const result = await indexManager.unifiedSearch({
      query: input.query,
      entityTypes: input.entityTypes,
      relatedTo: input.relatedTo,
      timeRange: input.timeRange,
      filters: input.filters,
      sortBy: input.sortBy || 'relevance',
      sortOrder: input.sortOrder || 'desc',
      limit: input.limit || 50,
      offset: input.offset || 0,
      operator: input.operator || 'AND'
    });

    return {
      results: result.results,
      count: result.counts.total,
      counts: result.counts,
      took: result.took,
      indexesUsed: result.indexesUsed
    };
  }

  // ==========================================================================
  // Session Query Tools
  // ==========================================================================

  /**
   * Execute search_session_screenshots tool
   *
   * Searches screenshots in the active session
   */
  private async executeSearchScreenshots(input: any) {
    if (!this.contextProvider) {
      throw new Error('No active session - cannot search screenshots');
    }

    const screenshots = this.contextProvider.searchScreenshots({
      activity: input.activity,
      text: input.text,
      elements: input.elements,
      hasAchievements: input.hasAchievements,
      hasBlockers: input.hasBlockers,
      minCuriosity: input.minCuriosity,
      since: input.since,
      until: input.until,
      limit: input.limit || 50
    });

    return {
      screenshots,
      count: screenshots.length
    };
  }

  /**
   * Execute search_session_audio tool
   *
   * Searches audio segments in the active session
   */
  private async executeSearchAudio(input: any) {
    if (!this.contextProvider) {
      throw new Error('No active session - cannot search audio');
    }

    const audioSegments = this.contextProvider.searchAudioSegments({
      text: input.text,
      phrases: input.phrases,
      sentiment: input.sentiment,
      containsTask: input.containsTask,
      containsBlocker: input.containsBlocker,
      since: input.since,
      until: input.until,
      limit: input.limit || 50
    });

    return {
      audioSegments,
      count: audioSegments.length
    };
  }

  /**
   * Execute get_progress_indicators tool
   *
   * Gets aggregated achievements, blockers, and insights
   */
  private async executeGetProgressIndicators(input: any): Promise<ProgressIndicators> {
    if (!this.contextProvider) {
      throw new Error('No active session - cannot get progress indicators');
    }

    // Get progress indicators (optionally filtered by time)
    const progress = this.contextProvider.getProgressIndicators(input.since);

    return {
      achievements: progress.achievements || [],
      blockers: progress.blockers || [],
      insights: progress.insights || []
    };
  }

  /**
   * Execute get_recent_activity tool
   *
   * Gets recent timeline of screenshots and audio
   */
  private async executeGetRecentActivity(input: any): Promise<TimelineItem[]> {
    if (!this.contextProvider) {
      throw new Error('No active session - cannot get recent activity');
    }

    const limit = input.limit || 20;
    const timeline = this.contextProvider.getRecentActivity(limit);

    // Map LiveSessionContextProvider.TimelineItem to toolExecutor.TimelineItem (adds id property)
    return timeline.map(item => {
      if (item.type === 'screenshot') {
        const screenshot = item.data as any;
        return {
          id: screenshot.id || `screenshot-${item.timestamp}`,
          type: 'screenshot' as const,
          timestamp: item.timestamp,
          data: item.data
        };
      } else {
        const audio = item.data as any;
        return {
          id: audio.id || `audio-${item.timestamp}`,
          type: 'audio' as const,
          timestamp: item.timestamp,
          data: item.data
        };
      }
    });
  }

  // ==========================================================================
  // Task/Note Creation Tools
  // ==========================================================================

  /**
   * Execute create_task tool
   *
   * Creates a new task using EntityService
   */
  private async executeCreateTask(input: any) {
    // Lazy import to avoid circular dependencies
    const { EntityService } = await import('../EntityService');
    const entityService = new EntityService();

    // Add session ID if active session exists
    const taskInput = {
      title: input.title,
      description: input.description || '',
      priority: input.priority || 'medium',
      status: 'todo',
      completed: false,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      tags: input.tags || [],
      topicId: input.topicId,
      noteId: input.noteId,
      sourceSessionId: input.sessionId || this.session?.id
    };

    const task = await entityService.createTask(taskInput);

    return {
      task,
      created: true
    };
  }

  /**
   * Execute create_note tool
   *
   * Creates a new note using EntityService
   */
  private async executeCreateNote(input: any) {
    // Lazy import to avoid circular dependencies
    const { EntityService } = await import('../EntityService');
    const entityService = new EntityService();

    // Add session ID if active session exists
    const noteInput = {
      content: input.content,
      topicId: input.topicId,
      tags: input.tags || [],
      companyIds: input.companyIds || [],
      contactIds: input.contactIds || [],
      sourceSessionId: input.sessionId || this.session?.id
    };

    const note = await entityService.createNote(noteInput);

    return {
      note,
      created: true
    };
  }

  // ==========================================================================
  // User Interaction Tools
  // ==========================================================================

  /**
   * Execute ask_user_question tool
   *
   * Asks the user a question and waits for response
   * Returns after user responds or timeout
   */
  private async executeAskUserQuestion(input: any): Promise<{
    answer: string | null;
    timedOut: boolean;
  }> {
    // This will be implemented in Phase 2 with event infrastructure
    // For now, return a placeholder
    console.warn('[LiveSessionToolExecutor] ask_user_question not yet implemented');

    return {
      answer: null,
      timedOut: true
    };
  }
}
