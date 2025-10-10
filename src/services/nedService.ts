/**
 * Ned Service - Main AI Assistant
 *
 * Ned is powered by Claude Sonnet and uses:
 * - Context Agent (Haiku) for information retrieval
 * - Tool calling for actions
 * - Memory system for context
 * - Permission system for safety
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AppState, Note, Task } from '../types';
import { NED_TOOLS, READ_TOOLS, WRITE_TOOLS, type ToolCall, type ToolResult } from './nedTools';
import { contextAgent } from './contextAgent';

// ============================================================================
// TYPES
// ============================================================================

export interface NedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: NedMessageContent[];
  timestamp: string;
}

export type NedMessageContent =
  | { type: 'text'; text: string }
  | { type: 'task-list'; tasks: Task[] }
  | { type: 'note-list'; notes: Note[] }
  | { type: 'tool-use'; tool: string; status: 'pending' | 'complete'; result?: any }
  | { type: 'thinking'; message: string };

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
  private client: Anthropic | null = null;
  private conversations: Map<string, NedConversation> = new Map();

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    }
  }

  setApiKey(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
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
   */
  async *sendMessage(
    conversationId: string,
    userMessage: string,
    appState: AppState,
    toolExecutor: ToolExecutor,
    permissionChecker: PermissionChecker
  ): AsyncGenerator<NedStreamChunk> {
    if (!this.client) {
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
      // Build Anthropic messages from conversation history
      const messages = this.buildAnthropicMessages(conversation.messages);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(appState);

      // Tool definitions
      const tools = Object.values(NED_TOOLS);

      console.log('[NedService] Making API call with', tools.length, 'tools');
      console.log('[NedService] Tools:', tools.map(t => t.name));
      console.log('[NedService] Messages:', messages);

      // Call Claude - may use tools
      let stream = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages,
        tools,
        stream: true,
      });

      let currentText = '';
      let currentToolUses: ToolCall[] = [];
      const assistantMsg: NedMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: [],
        timestamp: new Date().toISOString(),
      };

      // Track current tool being built
      let currentToolId: string | null = null;
      let currentToolName: string | null = null;
      let currentToolInput = '';

      // Multi-turn tool calling loop
      let continueLoop = true;
      let loopMessages = messages;
      let allTextChunks: string[] = [];

      while (continueLoop) {
        currentText = '';
        currentToolUses = [];
        currentToolId = null;
        currentToolName = null;
        currentToolInput = '';

        // Process stream
        for await (const event of stream) {
          console.log('[NedService] Stream event:', event.type, event);

          if (event.type === 'content_block_start') {
            const content = event.content_block;
            console.log('[NedService] Content block start:', content.type, content);

            if (content.type === 'text') {
              // Text block started
              continue;
            } else if (content.type === 'tool_use') {
              // Tool use started - save the ID and name
              currentToolId = content.id;
              currentToolName = content.name;
              currentToolInput = '';
              console.log('[NedService] Tool use started:', content.name, content.id);
              yield { type: 'thinking', content: `Using tool: ${content.name}...` };
            }
          } else if (event.type === 'content_block_delta') {
            const delta = event.delta;

            if (delta.type === 'text_delta') {
              // Stream text immediately
              currentText += delta.text;
              yield { type: 'text', content: delta.text };
            } else if (delta.type === 'input_json_delta') {
              // Accumulate tool input JSON
              currentToolInput += delta.partial_json;
              console.log('[NedService] Tool input accumulated:', currentToolInput);
            }
          } else if (event.type === 'content_block_stop') {
            console.log('[NedService] Content block stop, index:', event.index);

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
                currentToolUses.push(toolCall);
                yield { type: 'tool-use', toolName: toolCall.name };

                // Reset
                currentToolId = null;
                currentToolName = null;
                currentToolInput = '';
              } catch (err) {
                console.error('[NedService] Failed to parse tool input. Raw input length:', currentToolInput.length);
                console.error('[NedService] Raw input:', currentToolInput);
                console.error('[NedService] Parse error:', err);

                // Reset to prevent hanging
                currentToolId = null;
                currentToolName = null;
                currentToolInput = '';
              }
            }
          } else if (event.type === 'message_stop') {
            console.log('[NedService] Message stop - tool uses collected:', currentToolUses.length);
          }
        }

        // Save any text from this turn
        if (currentText) {
          allTextChunks.push(currentText);
        }

        // If tools were used, execute them and continue loop
        if (currentToolUses.length > 0) {
          console.log('[NedService] Tools used, executing and continuing...');
          const toolResults: ToolResult[] = [];

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

          // Create next stream iteration
          stream = await this.client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            system: systemPrompt,
            messages: loopMessages,
            tools,
            stream: true,
          });

          // Continue loop
          continueLoop = true;
        } else {
          // No more tools - we're done
          console.log('[NedService] No more tools, conversation complete');
          continueLoop = false;
        }
      }

      // Add all accumulated text to assistant message
      if (allTextChunks.length > 0) {
        const fullText = allTextChunks.join('');
        assistantMsg.content.push({ type: 'text', text: fullText });
      }

      // Add assistant message to conversation
      conversation.messages.push(assistantMsg);
      conversation.lastActive = new Date().toISOString();

      yield { type: 'complete' };

    } catch (error) {
      console.error('Ned error:', error);
      throw error;
    }
  }

  /**
   * Build system prompt for Ned
   */
  private buildSystemPrompt(appState: AppState): string {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    const userName = appState.userProfile.name || 'there';

    return `You are Ned, a helpful AI assistant for Taskerino.

**Context:** Today is ${currentDate}, time is ${currentTime}. User: ${userName}.

**Your Role:**
- Help users find and manage their tasks and notes
- Be smart about when to search vs when to use information you already have
- Be concise but friendly - keep responses under 3 sentences when possible

**CRITICAL: You Have a Large Context Window - Use It!**

When you call query_context_agent, you receive FULL task and note data (not summaries). This means:

✅ **After searching, you have ALL the data you need for follow-ups**
- User: "Show me tasks about NVIDIA"
- You: [search, get 12 tasks with full details]
- User: "What about the high priority ones?"
- You: **Just filter the data you already have!** No need to search again.

✅ **Answer follow-ups from context:**
- "Which are overdue?" → You have dueDate, just check it
- "What's the most urgent?" → You have priority, just sort
- "Tell me about that NVIDIA task" → You have all task details

❌ **DON'T search again for follow-ups:**
- User asks about same topic → Use data from previous search
- User wants filtering → Do it yourself from the data you have
- User wants details → They're in your context already

**When to Actually Search:**
1. **New topic** - User asks about something you haven't searched for
2. **Need more data** - You realize you're missing information
3. **User explicitly requests** - "Search for..." or "Find..."

**Example Conversation Flow:**

Turn 1:
User: "Show me tasks about NVIDIA"
You: "Let me search for that..." [calls query_context_agent]
     [Receives: 12 tasks with full details - titles, priorities, due dates, descriptions, etc.]
You: "I found 12 tasks about NVIDIA. Most are from Q4 planning discussions."

Turn 2:
User: "What about the high priority ones?"
You: [Looks at the 12 tasks already in context, filters by priority - NO new search!]
You: "From those 12 tasks, 3 are high priority: 'Submit NVIDIA proposal' (due tomorrow), 'Review Q4 deliverables' (urgent), and 'Schedule follow-up call' (due next week)."

Turn 3:
User: "Is the proposal one overdue?"
You: [Checks dueDate from context - NO new search!]
You: "No, it's due tomorrow, so still on track."

**Response Flow:**
1. Brief intro: "Let me search..." OR "Looking at those tasks..."
2. Use tool if needed OR filter from context
3. Provide focused summary highlighting what's most relevant

**Write Operations:**
Briefly confirm, then execute.

${appState.aiSettings.systemInstructions || ''}

Remember: You have excellent context - use it! Only search when you truly need NEW information.`;
  }

  /**
   * Build Anthropic messages from Ned messages
   */
  private buildAnthropicMessages(nedMessages: NedMessage[]): Anthropic.MessageParam[] {
    return nedMessages.map(msg => ({
      role: msg.role,
      content: msg.content
        .filter(c => c.type === 'text')
        .map(c => (c as any).text)
        .join('\n'),
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
