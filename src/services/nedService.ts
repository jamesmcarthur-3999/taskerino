/**
 * Ned Service - Main AI Assistant
 *
 * Ned is powered by Claude Sonnet and uses:
 * - Context Agent (Haiku) for information retrieval
 * - Tool calling for actions
 * - Memory system for context
 * - Permission system for safety
 *
 * MIGRATED TO TAURI STREAMING:
 * - Uses Tauri's event-based streaming instead of Anthropic SDK
 * - Listens for SSE events emitted from Rust backend
 * - Handles streaming chunks, tool calls, and errors via Tauri events
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  ClaudeStreamingRequest,
  ClaudeStreamChunk,
  ClaudeMessage as TauriClaudeMessage,
  ClaudeTool,
  ClaudeSystemBlock
} from '../types/tauri-ai-commands';
import type { AppState, Note, Task, Session } from '../types';
import { NED_TOOLS, READ_TOOLS, WRITE_TOOLS, type ToolCall, type ToolResult } from './nedTools';
import { contextAgent } from './contextAgent';
import { debug } from "../utils/debug";

// ============================================================================
// TYPES
// ============================================================================

export interface NedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: NedMessageContent[];
  timestamp: string;
}

export interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

export type NedMessageContent =
  | { type: 'text'; text: string }
  | { type: 'task-list'; tasks: Task[] }
  | { type: 'note-list'; notes: Note[] }
  | { type: 'session-list'; sessions: Session[] }
  | { type: 'task-update'; taskId: string; taskTitle: string; changes: FieldChange[]; timestamp: string }
  | { type: 'note-update'; noteId: string; noteSummary: string; changes: FieldChange[]; timestamp: string }
  | { type: 'task-created'; task: Task }
  | { type: 'note-created'; note: Note }
  | { type: 'tool-use'; tool: string; status: 'pending' | 'complete'; result?: any }
  | { type: 'thinking'; message: string }
  // API content blocks that must be preserved for conversation history
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ConversationContext {
  lastSearch: {
    query: string;
    results: {
      tasks: Task[];
      notes: Note[];
    };
    timestamp: string;
    thread_id: string;
    total_found: {
      tasks: number;
      notes: number;
    };
  } | null;

  referencedItems: {
    tasks: Set<string>; // IDs of tasks mentioned/shown
    notes: Set<string>; // IDs of notes mentioned/shown
    topics: Set<string>; // Topic IDs mentioned
  };
}

export interface NedConversation {
  id: string;
  messages: NedMessage[];
  agentThreadId?: string;
  context: ConversationContext;
  createdAt: string;
  lastActive: string;
}

export interface NedStreamChunk {
  type: 'text' | 'tool-use' | 'tool-result' | 'thinking' | 'error' | 'complete';
  content?: string;
  toolName?: string;
  isError?: boolean;
  result?: any;
}

// Tool execution callback types
export type ToolExecutor = (tool: ToolCall) => Promise<ToolResult>;
export type PermissionChecker = (toolName: string) => Promise<boolean>;

// ============================================================================
// NED SERVICE
// ============================================================================

export class NedService {
  private apiKey: string | null = null;
  private conversations: Map<string, NedConversation> = new Map();

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    } else {
      // Auto-load API key from storage like sessionsAgentService does
      this.loadApiKeyFromStorage();
    }
  }

  async setApiKey(apiKey: string) {
    // Store API key in Tauri backend via invoke
    await invoke('set_claude_api_key', { apiKey });
    this.apiKey = apiKey;
  }

  private async loadApiKeyFromStorage() {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (savedKey && savedKey.trim()) {
        this.apiKey = savedKey;
        debug.log(debug.log(console.log('✅ NedService: Loaded API key from storage')));
      } else {
        console.warn('⚠️ NedService: No API key found in storage');
      }
    } catch (error) {
      console.error('❌ NedService: Failed to load API key from storage:', error);
    }
  }

  /**
   * Create a new conversation
   */
  createConversation(): string {
    const convId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.conversations.set(convId, {
      id: convId,
      messages: [],
      context: {
        lastSearch: null,
        referencedItems: {
          tasks: new Set(),
          notes: new Set(),
          topics: new Set(),
        },
      },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    });
    return convId;
  }

  /**
   * Send a message to Ned and get streaming response
   *
   * STREAMING ARCHITECTURE:
   * 1. Generate unique streamId for this request
   * 2. Set up Tauri event listener BEFORE starting stream
   * 3. Invoke Rust command to start streaming
   * 4. Process SSE events as they arrive via the listener
   * 5. Handle tool calls in a loop (same as before)
   * 6. Clean up listeners when done
   */
  async *sendMessage(
    conversationId: string,
    userMessage: string,
    appState: AppState,
    toolExecutor: ToolExecutor,
    permissionChecker: PermissionChecker
  ): AsyncGenerator<NedStreamChunk> {
    if (!this.apiKey) {
      throw new Error('Ned: API key not set');
    }

    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      // Auto-create conversation if it doesn't exist
      conversation = {
        id: conversationId,
        messages: [],
        context: {
          lastSearch: null,
          referencedItems: {
            tasks: new Set(),
            notes: new Set(),
            topics: new Set(),
          },
        },
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      this.conversations.set(conversationId, conversation);
    }

    // Add user message to conversation
    const userMsg: NedMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: [{ type: 'text', text: userMessage }],
      timestamp: new Date().toISOString(),
    };
    conversation.messages.push(userMsg);

    try {
      // Build Claude messages from conversation history
      const messages = this.buildClaudeMessages(conversation.messages);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(appState);

      // Tool definitions
      const tools = this.convertToolsToClaudeFormat(Object.values(NED_TOOLS));

      console.log('[NedService] Making API call with', tools.length, 'tools');
      console.log('[NedService] Tools:', tools.map(t => t.name));
      console.log('[NedService] Messages:', messages);

      // Assistant message to build up
      const assistantMsg: NedMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: [],
        timestamp: new Date().toISOString(),
      };

      // Multi-turn tool calling loop
      let continueLoop = true;
      let loopMessages = messages;
      const allTextChunks: string[] = [];

      while (continueLoop) {
        // Track chunks from this streaming turn
        let currentText = '';
        let currentToolUses: ToolCall[] = [];

        // Execute one streaming turn
        const streamResult = await this.executeStreamingTurn(
          loopMessages,
          systemPrompt,
          tools
        );

        // Process all chunks from this turn
        for await (const chunk of streamResult.chunks) {
          if (chunk.type === 'text') {
            currentText += chunk.content || '';
            yield { type: 'text', content: chunk.content };
          } else if (chunk.type === 'tool-use') {
            currentToolUses.push(chunk.toolCall!);
            yield { type: 'thinking', content: `Using tool: ${chunk.toolCall!.name}...` };
            yield { type: 'tool-use', toolName: chunk.toolCall!.name };
          } else if (chunk.type === 'error') {
            yield chunk;
          }
        }

        // Save text from this turn
        if (currentText) {
          allTextChunks.push(currentText);
        }

        // If tools were used, execute them and continue loop
        if (currentToolUses.length > 0) {
          console.log('[NedService] Tools used, executing and continuing...');
          const toolResults: ToolResult[] = [];

          // Save text from this turn to assistant message BEFORE adding tool_use blocks
          // This preserves the correct order: text comes before tool_use in assistant messages
          if (currentText) {
            assistantMsg.content.push({
              type: 'text',
              text: currentText
            });
          }

          // Save tool_use blocks to assistant message BEFORE execution
          // This ensures conversation history includes the tool calls
          for (const toolCall of currentToolUses) {
            assistantMsg.content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input,
            });
          }

          // Execute all tools
          for (const toolCall of currentToolUses) {
            try {
              // Check permission for write tools
              if (WRITE_TOOLS.includes(toolCall.name)) {
                const hasPermission = await permissionChecker(toolCall.name);
                if (!hasPermission) {
                  const result: ToolResult = {
                    tool_use_id: toolCall.id,
                    content: 'Permission denied by user',
                    is_error: true,
                  };
                  toolResults.push(result);
                  yield { type: 'tool-result', toolName: toolCall.name, isError: true, result };
                  continue;
                }
              }

              // Execute tool
              const result = await toolExecutor(toolCall);
              toolResults.push(result);
              yield { type: 'tool-result', toolName: toolCall.name, isError: false, result };

            } catch (error) {
              const errorResult: ToolResult = {
                tool_use_id: toolCall.id,
                content: `Tool execution failed: ${error}`,
                is_error: true,
              };
              toolResults.push(errorResult);
              yield { type: 'tool-result', toolName: toolCall.name, isError: true, result: errorResult };
            }
          }

          // Add tool results to conversation as a user message
          // This is required by Claude API - tool results must come from user role
          const toolResultMsg: NedMessage = {
            id: `msg_${Date.now() + 2}`,
            role: 'user',
            content: toolResults.map(result => ({
              type: 'tool_result',
              tool_use_id: result.tool_use_id,
              content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
              is_error: result.is_error,
            })),
            timestamp: new Date().toISOString(),
          };
          conversation.messages.push(assistantMsg);
          conversation.messages.push(toolResultMsg);

          // Build new messages array for next iteration
          loopMessages = [
            ...loopMessages,
            {
              role: 'assistant' as const,
              content: [
                ...(currentText ? [{ type: 'text' as const, text: currentText }] : []),
                ...currentToolUses.map(tc => ({
                  type: 'tool_use' as const,
                  id: tc.id,
                  name: tc.name,
                  input: tc.input,
                })),
              ],
            },
            {
              role: 'user' as const,
              content: toolResults.map(result => ({
                type: 'tool_result' as const,
                tool_use_id: result.tool_use_id,
                content: typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
                is_error: result.is_error,
              })),
            },
          ];

          // Reset assistant message for next turn
          assistantMsg.id = `msg_${Date.now() + 3}`;
          assistantMsg.content = [];
          assistantMsg.timestamp = new Date().toISOString();

          // Continue loop with new messages
          continueLoop = true;
        } else {
          // No more tools - we're done
          console.log('[NedService] No more tools, conversation complete');
          continueLoop = false;
        }
      }

      // Add all accumulated text to final assistant message
      if (allTextChunks.length > 0) {
        const fullText = allTextChunks.join('');
        assistantMsg.content.push({ type: 'text', text: fullText });
      }

      // Add final assistant message to conversation (only if it has content or is the final response)
      if (assistantMsg.content.length > 0) {
        conversation.messages.push(assistantMsg);
      }
      conversation.lastActive = new Date().toISOString();

      yield { type: 'complete' };

    } catch (error) {
      console.error('Ned error:', error);
      throw error;
    }
  }

  /**
   * Execute a single streaming turn with Claude
   *
   * This method handles the Tauri event-based streaming:
   * 1. Generate unique streamId
   * 2. Set up event listener for "claude-stream-{streamId}"
   * 3. Invoke claude_chat_completion_stream command
   * 4. Process events as they arrive
   * 5. Clean up listener when done
   */
  private async executeStreamingTurn(
    messages: TauriClaudeMessage[],
    systemPrompt: ClaudeSystemBlock[],
    tools: ClaudeTool[]
  ): Promise<{
    chunks: AsyncGenerator<{
      type: 'text' | 'tool-use' | 'error';
      content?: string;
      toolCall?: ToolCall;
    }>;
  }> {
    // Generate unique stream ID for this request
    const streamId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const eventName = `claude-stream-${streamId}`;

    // Create async generator to yield chunks
    const generator = async function* (
      streamId: string,
      eventName: string,
      messages: TauriClaudeMessage[],
      systemPrompt: ClaudeSystemBlock[],
      tools: ClaudeTool[]
    ): AsyncGenerator<{
      type: 'text' | 'tool-use' | 'error';
      content?: string;
      toolCall?: ToolCall;
    }> {
      let unlisten: UnlistenFn | null = null;

      // Queue to store chunks received from events
      const chunkQueue: Array<{
        type: 'text' | 'tool-use' | 'error' | 'complete';
        content?: string;
        toolCall?: ToolCall;
      }> = [];

      let streamComplete = false;
      let streamError: string | null = null;
      let resolveNext: (() => void) | null = null;

      // Track current tool being built from streaming chunks
      let currentToolId: string | null = null;
      let currentToolName: string | null = null;
      let currentToolInput = '';
      let currentThinkingContent = ''; // Track extended thinking content

      try {
        // STEP 1: Set up event listener BEFORE starting stream
        unlisten = await listen<ClaudeStreamChunk>(eventName, (event) => {
          const chunk = event.payload;
          console.log('[NedService] Stream event:', chunk.type, chunk);

          if (chunk.type === 'content_block_start') {
            const contentBlock = (chunk as any).contentBlock;
            console.log('[NedService] Content block start:', contentBlock.type, contentBlock);

            if (contentBlock.type === 'tool_use') {
              // Tool use started - save the ID and name
              currentToolId = contentBlock.id;
              currentToolName = contentBlock.name;
              currentToolInput = '';
              console.log('[NedService] Tool use started:', contentBlock.name, contentBlock.id);
            } else if (contentBlock.type === 'thinking') {
              // Extended thinking block started
              currentThinkingContent = '';
              console.log('[NedService] Extended thinking started');
            }
          } else if (chunk.type === 'content_block_delta') {
            const delta = (chunk as any).delta;

            if (delta.type === 'text_delta') {
              // Stream text immediately
              chunkQueue.push({ type: 'text', content: delta.text });
              if (resolveNext) {
                resolveNext();
                resolveNext = null;
              }
            } else if (delta.type === 'input_json_delta') {
              // Accumulate tool input JSON
              currentToolInput += delta.partialJson;
              console.log('[NedService] Tool input accumulated:', currentToolInput);
            } else if (delta.type === 'thinking_delta') {
              // Accumulate thinking content (not yielded to avoid cluttering output)
              currentThinkingContent += delta.thinking || '';
              console.log('[NedService] Thinking accumulated:', currentThinkingContent.length, 'chars');
            }
          } else if (chunk.type === 'content_block_stop') {
            console.log('[NedService] Content block stop');

            // If we were building a tool, finalize it
            if (currentToolId && currentToolName) {
              try {
                // If input is empty (tool has no parameters), default to empty object
                const inputToParse = currentToolInput.trim() || '{}';
                console.log('[NedService] Attempting to parse tool input:', inputToParse);
                const parsedInput = JSON.parse(inputToParse);
                const toolCall: ToolCall = {
                  id: currentToolId,
                  name: currentToolName,
                  input: parsedInput,
                };
                console.log('[NedService] Tool use complete:', toolCall);
                chunkQueue.push({ type: 'tool-use', toolCall });

                // Reset
                currentToolId = null;
                currentToolName = null;
                currentToolInput = '';

                if (resolveNext) {
                  resolveNext();
                  resolveNext = null;
                }
              } catch (err) {
                console.error('[NedService] Failed to parse tool input. Raw input length:', currentToolInput.length);
                console.error('[NedService] Raw input:', currentToolInput);
                console.error('[NedService] Parse error:', err);

                // Yield error to UI instead of silently dropping the tool
                const errorMessage = `Failed to parse input for tool "${currentToolName}": ${err}`;
                chunkQueue.push({
                  type: 'error',
                  content: errorMessage
                });

                // Reset to prevent hanging
                currentToolId = null;
                currentToolName = null;
                currentToolInput = '';

                if (resolveNext) {
                  resolveNext();
                  resolveNext = null;
                }
              }
            }
          } else if (chunk.type === 'message_stop' || chunk.type === 'stream_end') {
            console.log('[NedService] Stream complete');
            streamComplete = true;
            chunkQueue.push({ type: 'complete' });
            if (resolveNext) {
              resolveNext();
              resolveNext = null;
            }
          } else if (chunk.type === 'error') {
            const error = (chunk as any).error;
            console.error('[NedService] Stream error:', error);
            const errorMessage = error.message || 'Unknown streaming error';
            streamError = errorMessage;
            streamComplete = true;
            chunkQueue.push({ type: 'error', content: errorMessage });
            if (resolveNext) {
              resolveNext();
              resolveNext = null;
            }
          }
        });

        // STEP 2: Start the stream by invoking Rust command
        const request: ClaudeStreamingRequest = {
          model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5
          maxTokens: 8192,
          messages,
          system: systemPrompt,
          tools,
          stream: true,
          extended_thinking: true, // Enable extended thinking for complex reasoning
        };

        console.log('[NedService] Starting stream with request:', {
          model: request.model,
          messageCount: messages.length,
          systemPromptBlocks: systemPrompt.length,
          systemPromptTotalLength: systemPrompt.reduce((sum, block) => sum + block.text.length, 0),
          toolCount: tools.length,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        });
        console.log('[NedService] Full system prompt:', systemPrompt);
        console.log('[NedService] Tool names:', tools.map(t => t.name));

        await invoke('claude_chat_completion_stream', {
          streamId,
          request,
        });

        // STEP 3: Yield chunks as they arrive
        while (!streamComplete || chunkQueue.length > 0) {
          if (chunkQueue.length > 0) {
            const chunk = chunkQueue.shift()!;
            if (chunk.type !== 'complete') {
              yield chunk as { type: 'text' | 'tool-use' | 'error'; content?: string; toolCall?: ToolCall };
            }
          } else {
            // Wait for next chunk
            await new Promise<void>(resolve => {
              resolveNext = resolve;
              // Set timeout to prevent infinite waiting
              setTimeout(() => {
                if (resolveNext === resolve) {
                  resolveNext = null;
                  resolve();
                }
              }, 30000); // 30 second timeout
            });
          }
        }

        if (streamError) {
          throw new Error(streamError);
        }

      } finally {
        // STEP 4: Clean up listener
        if (unlisten) {
          unlisten();
        }
      }
    };

    return {
      chunks: generator(streamId, eventName, messages, systemPrompt, tools),
    };
  }

  /**
   * Build system prompt for Ned with prompt caching support
   */
  private buildSystemPrompt(appState: AppState): ClaudeSystemBlock[] {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    const userName = appState.userProfile.name || 'there';

    return [
      {
        type: 'text',
        text: `<role>
You are Ned, a helpful AI assistant for Taskerino.
</role>

<context>
Date: ${currentDate}
Time: ${currentTime}
User: ${userName}
</context>

<primary_goal>
Help users find and manage their tasks, notes, and work sessions efficiently.
</primary_goal>

<guidelines>
- Be concise but friendly
- Keep responses under 3 sentences for simple queries
- Use code blocks (\`\`\`) for copyable text (emails, Slack messages, etc.)
- Lists with 3+ items will auto-collapse with "Show more"
</guidelines>

<tool_usage>
**CRITICAL - Large Context Window:**
When you use search tools (query_context_agent, query_sessions), you receive FULL data with all details.

After searching once:
✅ You have all the data for follow-up questions
- User: "Show me NVIDIA tasks" → You get full task details
- User: "Which are high priority?" → Just filter what you already have, don't search again

❌ Don't search again for:
- Filtering ("just the high priority ones")
- Sorting ("which is most urgent?")
- Details ("tell me about that task")

Only search when you need NEW information about a different topic.
</tool_usage>
${appState.aiSettings.systemInstructions ? `\n<custom_instructions>\n${appState.aiSettings.systemInstructions}\n</custom_instructions>` : ''}`,
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  /**
   * Build Claude messages from Ned messages
   * Converts internal NedMessage format to Tauri's ClaudeMessage format
   *
   * CRITICAL: Preserves ALL tool_use and tool_result blocks as required by Claude API.
   * According to Anthropic documentation, the complete conversation history including
   * all tool_use and tool_result blocks MUST be preserved and sent with each request.
   *
   * IMPORTANT: Claude API requires all messages to have non-empty content
   * (except for the optional final assistant message)
   */
  private buildClaudeMessages(nedMessages: NedMessage[]): TauriClaudeMessage[] {
    return nedMessages
      .map(msg => {
        // Build content blocks array by extracting API-relevant content
        const contentBlocks: any[] = [];

        for (const content of msg.content) {
          if (content.type === 'text') {
            // Text content block
            contentBlocks.push({
              type: 'text',
              text: content.text
            });
          } else if (content.type === 'tool_use') {
            // Tool use block - MUST be preserved in conversation history
            contentBlocks.push({
              type: 'tool_use',
              id: content.id,
              name: content.name,
              input: content.input
            });
          } else if (content.type === 'tool_result') {
            // Tool result block - MUST be preserved in conversation history
            contentBlocks.push({
              type: 'tool_result',
              tool_use_id: content.tool_use_id,
              content: content.content,
              is_error: content.is_error
            });
          }
          // Skip UI-only content types (task-list, note-list, tool-use display, etc.)
          // These are for frontend display only and not part of the API conversation
        }

        // Simplify to string if only one text block (common case for simple messages)
        if (contentBlocks.length === 1 && contentBlocks[0].type === 'text') {
          return {
            role: msg.role,
            content: contentBlocks[0].text
          };
        }

        // Use array format for multiple blocks or non-text blocks
        return {
          role: msg.role,
          content: contentBlocks
        };
      })
      .filter((msg, index, array) => {
        // Filter out messages with empty content
        // BUT: Keep the last message if it's from assistant (Claude allows empty final assistant message)
        const isLastMessage = index === array.length - 1;
        const isAssistant = msg.role === 'assistant';

        // Check if content is empty
        const isEmpty = Array.isArray(msg.content)
          ? msg.content.length === 0
          : msg.content === '';

        if (isEmpty) {
          // Allow empty content ONLY for final assistant message
          return isLastMessage && isAssistant;
        }

        return true; // Keep all messages with content
      });
  }

  /**
   * Convert Ned tool definitions to Claude API format
   */
  private convertToolsToClaudeFormat(tools: any[]): ClaudeTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema,
      ...(tool.cache_control ? { cache_control: tool.cache_control } : {}),
    }));
  }

  /**
   * Get conversation
   */
  getConversation(conversationId: string): NedConversation | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Clear conversation
   */
  clearConversation(conversationId: string) {
    this.conversations.delete(conversationId);
  }
}

// Singleton instance
export const nedService = new NedService();
