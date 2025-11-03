/**
 * Ned Service - BaleyBots Implementation
 *
 * Uses BaleyBots SDK running in Bun process for LLM calls.
 * Tool execution remains in frontend (tools need React state).
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { z } from 'zod';
import type { AppState, Note, Task, Session } from '../types';
import { NED_TOOLS, READ_TOOLS, WRITE_TOOLS, type ToolCall, type ToolResult } from './nedTools';
import type {
  NedMessage,
  NedMessageContent,
  NedConversation,
  NedStreamChunk,
  ToolExecutor,
  PermissionChecker,
} from './nedTypes';

// ============================================================================
// TYPES
// ============================================================================

interface BaleybotRequest {
  stream_id: string;
  message: string;
  model: string;
  system_prompt?: string;
  tools?: Record<string, any>;
  agent_mode: boolean;
  max_tool_iterations?: number;
  conversation_history?: Array<{ role: string; content: string }>;
}

interface BaleybotStreamEvent {
  streamId: string;
  event?: {
    type: string;
    content?: string;
    id?: string;
    toolName?: string;
    arguments?: Record<string, any>;
    argumentsDelta?: string;
    result?: any;
    error?: string;
  };
  type?: string;
  error?: {
    message: string;
  };
}

// ============================================================================
// NED SERVICE BALEYBOTS
// ============================================================================

export class NedServiceBaleybots {
  private apiKey: string | null = null;
  private conversations: Map<string, NedConversation> = new Map();

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    } else {
      // Auto-load API key from storage
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
        console.log('✅ NedServiceBaleybots: Loaded API key from storage');
      } else {
        console.warn('⚠️ NedServiceBaleybots: No API key found in storage');
      }
    } catch (error) {
      console.error('❌ NedServiceBaleybots: Failed to load API key from storage:', error);
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
   * Convert JSON Schema property to Zod schema
   */
  private jsonSchemaToZod(propSchema: any, required: boolean = true): z.ZodTypeAny {
    const type = propSchema.type || 'string';
    const description = propSchema.description || '';

    let zodType: z.ZodTypeAny;

    switch (type) {
      case 'string':
        zodType = z.string();
        if (propSchema.enum) {
          zodType = z.enum(propSchema.enum as [string, ...string[]]);
        }
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        const itemSchema = propSchema.items || { type: 'string' };
        zodType = z.array(this.jsonSchemaToZod(itemSchema, true));
        break;
      case 'object':
        if (propSchema.properties) {
          const shape: Record<string, z.ZodTypeAny> = {};
          const objRequired = propSchema.required || [];
          for (const [key, value] of Object.entries(propSchema.properties)) {
            shape[key] = this.jsonSchemaToZod(value as any, objRequired.includes(key));
          }
          zodType = z.object(shape);
        } else {
          zodType = z.record(z.any());
        }
        break;
      default:
        zodType = z.any();
    }

    if (description) {
      zodType = zodType.describe(description);
    }

    if (!required) {
      zodType = zodType.optional();
    }

    return zodType;
  }

  /**
   * Convert NED_TOOLS JSON Schema format to BaleyBots ToolDefinition format
   * Uses Zod schemas internally for type safety, then converts to parameters for serialization
   */
  private convertNedToolToBaleybotFormat(nedTool: {
    name: string;
    description: string;
    input_schema: {
      type: string;
      properties?: Record<string, any>;
      required?: string[];
    };
  }): {
    name: string;
    description: string;
    parameters: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      enum?: (string | number)[];
      items?: any;
      properties?: Record<string, any>;
    }>;
    function: () => null;
  } {
    const inputSchema = nedTool.input_schema;
    const properties = inputSchema.properties || {};
    const required = inputSchema.required || [];

    // Convert to Zod schema first for validation
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [propName, propSchema] of Object.entries(properties)) {
      const isRequired = required.includes(propName);
      shape[propName] = this.jsonSchemaToZod(propSchema as any, isRequired);
    }

    // Convert Zod schema back to parameters format for JSON serialization
    // This ensures type safety through Zod while maintaining compatibility
    const parameters: Record<string, any> = {};
    for (const [propName, propSchema] of Object.entries(properties)) {
      const prop = propSchema as any;
      const isRequired = required.includes(propName);
      
      parameters[propName] = {
        type: prop.type || 'string',
        description: prop.description || '',
        required: isRequired,
        ...(prop.enum && { enum: prop.enum }),
        ...(prop.items && { items: prop.items }),
        ...(prop.properties && { properties: prop.properties }),
      };
    }

    return {
      name: nedTool.name,
      description: nedTool.description,
      parameters,
      function: () => null, // Placeholder - never called since agentMode: true with stubs
    };
  }

  /**
   * Convert NED_TOOLS to BaleyBots format
   */
  private convertToolsToBaleybotFormat(): Record<string, any> {
    const tools: Record<string, any> = {};
    for (const [key, nedTool] of Object.entries(NED_TOOLS)) {
      tools[key] = this.convertNedToolToBaleybotFormat(nedTool);
    }
    return tools;
  }

  /**
   * Build system prompt (reuse logic from nedService)
   */
  private buildSystemPrompt(appState: AppState): string {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0];
    const userName = appState.userProfile.name || 'there';

    return `<role>
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
${appState.aiSettings.systemInstructions ? `\n<custom_instructions>\n${appState.aiSettings.systemInstructions}\n</custom_instructions>` : ''}`;
  }

  /**
   * Convert BaleyBots StreamEvent to NedStreamChunk
   */
  private convertBaleybotEventToChunk(event: BaleybotStreamEvent['event']): NedStreamChunk | null {
    if (!event) return null;

    switch (event.type) {
      case 'text_delta':
        return {
          type: 'text',
          content: event.content || '',
        };
      case 'tool_call_stream_start':
        return {
          type: 'tool-use',
          toolName: event.toolName || '',
        };
      case 'tool_call_stream_complete':
        // This will be handled separately to extract tool call
        return null;
      case 'tool_execution_start':
        return {
          type: 'thinking',
          content: `Executing tool: ${event.toolName}...`,
        };
      case 'tool_execution_output':
        return {
          type: 'tool-result',
          toolName: event.toolName || '',
          isError: !!event.error,
          result: event.result || event.error,
        };
      case 'error':
        return {
          type: 'error',
          content: event.error || 'Unknown error',
        };
      default:
        return null;
    }
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
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(appState);

      // Convert tools to BaleyBots format
      const tools = this.convertToolsToBaleybotFormat();

      // Assistant message to build up
      const assistantMsg: NedMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: [],
        timestamp: new Date().toISOString(),
      };

      // Multi-turn tool calling loop
      let continueLoop = true;
      const allTextChunks: string[] = [];
      let maxIterations = 10;
      let iterationCount = 0;
      
      // Build conversation history from existing messages
      const conversationHistory: Array<{ role: string; content: string }> = [];
      for (const msg of conversation.messages) {
        if (msg.role === 'user') {
          // Extract text content from user messages
          const textContent = msg.content
            .filter(c => c.type === 'text')
            .map(c => (c.type === 'text' ? c.text : ''))
            .join('');
          if (textContent) {
            conversationHistory.push({ role: 'user', content: textContent });
          }
        } else if (msg.role === 'assistant') {
          // Extract text content from assistant messages
          const textContent = msg.content
            .filter(c => c.type === 'text')
            .map(c => (c.type === 'text' ? c.text : ''))
            .join('');
          if (textContent) {
            conversationHistory.push({ role: 'assistant', content: textContent });
          }
        }
      }
      // Add current user message
      conversationHistory.push({ role: 'user', content: userMessage });

      while (continueLoop && iterationCount < maxIterations) {
        iterationCount++;

        // Generate unique stream ID
        const streamId = `baleybot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const eventName = `baleybot-stream-${streamId}`;

        // Build request with full conversation history
        const lastMessage = conversationHistory[conversationHistory.length - 1];
        const request: BaleybotRequest = {
          stream_id: streamId,
          message: lastMessage.content,
          model: 'gpt-4.1',
          system_prompt: systemPrompt,
          tools: tools,
          agent_mode: true, // Worker handles stub tools, frontend executes
          max_tool_iterations: 3, // Allow tool execution + result processing + final response
          conversation_history: conversationHistory, // Pass full history
        };

        // Track tool calls from this turn
        let currentToolCalls: Array<{ id: string; name: string; arguments: Record<string, any> }> = [];
        let currentText = '';
        let eventQueue: Array<BaleybotStreamEvent> = [];
        let streamComplete = false;
        let streamError: string | null = null;
        let resolveNext: (() => void) | null = null;
        
        // Track tool call arguments being streamed
        const toolCallArguments: Record<string, string> = {}; // toolId -> accumulated arguments string

        // Set up event listener
        const unlisten = await listen<BaleybotStreamEvent>(eventName, (event) => {
          const payload = event.payload;
          console.log('[NedServiceBaleybots] Raw event payload received:', {
            type: payload.type,
            hasEvent: !!payload.event,
            eventType: payload.event?.type,
            fullPayload: JSON.stringify(payload, null, 2).substring(0, 500),
          });
          eventQueue.push(payload);

          if (payload.type === 'complete' || payload.type === 'error') {
            streamComplete = true;
            if (resolveNext) {
              resolveNext();
              resolveNext = null;
            }
          } else if (resolveNext) {
            resolveNext();
            resolveNext = null;
          }
        });

        // Invoke BaleyBots
        await invoke('baleybot_invoke', {
          streamId,
          request,
        });

        // Process events as they arrive
        while (!streamComplete || eventQueue.length > 0) {
          if (eventQueue.length > 0) {
            const event = eventQueue.shift()!;

            if (event.type === 'complete') {
              streamComplete = true;
              break;
            } else if (event.type === 'error') {
              yield {
                type: 'error',
                content: event.error?.message || 'Unknown error',
              };
              streamError = event.error?.message || 'Unknown error';
              streamComplete = true;
              break;
            } else if (event.event) {
              // Debug: Log all event types
              console.log('[NedServiceBaleybots] Event received:', event.event.type, {
                id: event.event.id,
                toolName: event.event.toolName,
                hasArguments: !!event.event.arguments,
                argumentsType: typeof event.event.arguments,
                hasArgumentsDelta: !!event.event.argumentsDelta,
                argumentsDeltaLength: event.event.argumentsDelta?.length,
              });
              
              // Handle tool_call_stream_start - initialize arguments tracking
              if (event.event.type === 'tool_call_stream_start' && event.event.id) {
                console.log('[NedServiceBaleybots] Tool call stream start:', event.event.id, event.event.toolName);
                toolCallArguments[event.event.id] = '';
                // Yield the start event to show tool use beginning
                const chunk = this.convertBaleybotEventToChunk(event.event);
                if (chunk) {
                  yield chunk;
                }
              }
              // Handle tool_call_stream_delta - accumulate tool call arguments
              else if (event.event.type === 'tool_call_stream_delta' && event.event.id && event.event.argumentsDelta) {
                console.log('[NedServiceBaleybots] Tool call stream delta:', {
                  toolId: event.event.id,
                  delta: event.event.argumentsDelta,
                  deltaLength: event.event.argumentsDelta.length,
                });
                if (!toolCallArguments[event.event.id]) {
                  toolCallArguments[event.event.id] = '';
                  console.log('[NedServiceBaleybots] Initialized arguments tracking for:', event.event.id);
                }
                toolCallArguments[event.event.id] += event.event.argumentsDelta;
                console.log('[NedServiceBaleybots] Accumulated arguments so far:', {
                  toolId: event.event.id,
                  length: toolCallArguments[event.event.id].length,
                  preview: toolCallArguments[event.event.id].substring(0, 200),
                });
                // Don't yield delta events - they're just for internal tracking
              }
              // Handle tool_call_stream_complete to extract tool call
              else if (event.event.type === 'tool_call_stream_complete') {
                const toolId = event.event.id || `tool_${Date.now()}`;
                console.log('[NedServiceBaleybots] Tool call stream complete:', {
                  toolId,
                  toolName: event.event.toolName,
                  hasArguments: !!event.event.arguments,
                  argumentsType: typeof event.event.arguments,
                  hasAccumulatedArguments: !!toolCallArguments[toolId],
                  accumulatedLength: toolCallArguments[toolId]?.length,
                  fullEvent: JSON.stringify(event.event, null, 2),
                });
                
                // Check if we've already processed a tool call with this toolName in this turn
                // This prevents duplicate processing of the same tool call
                const existingToolCall = currentToolCalls.find(tc => tc.name === event.event.toolName);
                if (existingToolCall) {
                  console.log('[NedServiceBaleybots] Skipping duplicate tool call event:', {
                    toolId,
                    toolName: event.event.toolName,
                    reason: 'Already processed a tool call with this name in this turn',
                    existingToolCallId: existingToolCall.id,
                  });
                  // Clean up accumulated arguments if they exist
                  if (toolCallArguments[toolId]) {
                    delete toolCallArguments[toolId];
                  }
                  continue; // Skip to next event
                }
                
                let parsedArguments: Record<string, any> = {};
                let hasValidArguments = false;
                
                // Try to get arguments from the event or accumulated deltas
                if (event.event.arguments) {
                  console.log('[NedServiceBaleybots] Using arguments from event:', {
                    type: typeof event.event.arguments,
                    isObject: typeof event.event.arguments === 'object' && !Array.isArray(event.event.arguments),
                    isString: typeof event.event.arguments === 'string',
                    value: typeof event.event.arguments === 'string' 
                      ? event.event.arguments.substring(0, 200) 
                      : event.event.arguments,
                  });
                  
                  // If arguments is already an object, use it
                  if (typeof event.event.arguments === 'object' && !Array.isArray(event.event.arguments)) {
                    console.log('[NedServiceBaleybots] Arguments is object, using directly');
                    parsedArguments = event.event.arguments;
                    hasValidArguments = Object.keys(parsedArguments).length > 0;
                  } else if (typeof event.event.arguments === 'string') {
                    // If arguments is a string, try to parse it as JSON
                    console.log('[NedServiceBaleybots] Arguments is string, attempting to parse:', {
                      length: event.event.arguments.length,
                      preview: event.event.arguments.substring(0, 200),
                    });
                    try {
                      const argsString = event.event.arguments.trim();
                      // Check if it looks like JSON (starts with { or [)
                      if (argsString.startsWith('{') || argsString.startsWith('[')) {
                        parsedArguments = argsString ? JSON.parse(argsString) : {};
                        hasValidArguments = Object.keys(parsedArguments).length > 0;
                        console.log('[NedServiceBaleybots] Successfully parsed arguments from string');
                      } else {
                        // Not JSON format, treat as invalid
                        console.warn('[NedServiceBaleybots] Arguments string is not JSON format, treating as invalid:', {
                          preview: argsString.substring(0, 100),
                        });
                        hasValidArguments = false;
                      }
                    } catch (e) {
                      console.error('[NedServiceBaleybots] Failed to parse arguments string:', e);
                      console.error('[NedServiceBaleybots] Raw arguments string:', event.event.arguments);
                      console.error('[NedServiceBaleybots] Raw arguments string length:', event.event.arguments.length);
                      hasValidArguments = false;
                    }
                  }
                }
                
                // If event arguments were invalid or missing, try accumulated deltas
                if (!hasValidArguments && toolCallArguments[toolId]) {
                  // Use accumulated arguments from deltas
                  console.log('[NedServiceBaleybots] Using accumulated arguments from deltas:', {
                    toolId,
                    accumulatedLength: toolCallArguments[toolId].length,
                    fullAccumulated: toolCallArguments[toolId],
                  });
                  try {
                    const argsString = toolCallArguments[toolId].trim();
                    console.log('[NedServiceBaleybots] Attempting to parse accumulated arguments:', {
                      trimmedLength: argsString.length,
                      trimmedPreview: argsString.substring(0, 200),
                    });
                    parsedArguments = argsString ? JSON.parse(argsString) : {};
                    hasValidArguments = Object.keys(parsedArguments).length > 0;
                    if (hasValidArguments) {
                      console.log('[NedServiceBaleybots] Successfully parsed accumulated arguments');
                    } else {
                      console.warn('[NedServiceBaleybots] Parsed arguments from deltas but object is empty');
                    }
                  } catch (e) {
                    console.error('[NedServiceBaleybots] Failed to parse accumulated arguments:', e);
                    console.error('[NedServiceBaleybots] Raw arguments string:', toolCallArguments[toolId]);
                    console.error('[NedServiceBaleybots] Raw arguments string length:', toolCallArguments[toolId].length);
                    console.error('[NedServiceBaleybots] Raw arguments string (first 500 chars):', toolCallArguments[toolId].substring(0, 500));
                    console.error('[NedServiceBaleybots] Raw arguments string (last 500 chars):', toolCallArguments[toolId].substring(Math.max(0, toolCallArguments[toolId].length - 500)));
                    hasValidArguments = false;
                  }
                }
                
                // Only process tool call if we have valid arguments
                if (!hasValidArguments) {
                  console.warn('[NedServiceBaleybots] No valid arguments found for tool call, skipping:', {
                    toolId,
                    toolName: event.event.toolName,
                  });
                  // Clean up accumulated arguments
                  if (toolCallArguments[toolId]) {
                    delete toolCallArguments[toolId];
                  }
                  continue; // Skip this event
                }
                
                console.log('[NedServiceBaleybots] Final parsed arguments:', {
                  toolId,
                  toolName: event.event.toolName,
                  arguments: parsedArguments,
                  argumentsKeys: Object.keys(parsedArguments),
                });
                
                currentToolCalls.push({
                  id: toolId,
                  name: event.event.toolName || '',
                  arguments: parsedArguments,
                });
                yield {
                  type: 'tool-use',
                  toolName: event.event.toolName || '',
                };
                
                // Clean up accumulated arguments
                delete toolCallArguments[toolId];
              } else {
                // Convert other events
                const chunk = this.convertBaleybotEventToChunk(event.event);
                if (chunk) {
                  if (chunk.type === 'text') {
                    currentText += chunk.content || '';
                  }
                  yield chunk;
                }
              }
            }
          } else {
            // Wait for next event
            await new Promise<void>((resolve) => {
              resolveNext = resolve;
              // Timeout to prevent infinite waiting
              setTimeout(() => {
                if (resolveNext === resolve) {
                  resolveNext = null;
                  resolve();
                }
              }, 30000); // 30 second timeout
            });
          }
        }

        // Clean up listener
        unlisten();

        // Handle errors
        if (streamError) {
          continueLoop = false;
          continue;
        }

        // Save text from this turn
        if (currentText) {
          allTextChunks.push(currentText);
        }

        // If tools were used, execute them and continue loop
        if (currentToolCalls.length > 0) {
          console.log('[NedServiceBaleybots] Tools used, executing and continuing...');
          const toolResults: ToolResult[] = [];

          // Save text from this turn to assistant message
          if (currentText) {
            assistantMsg.content.push({
              type: 'text',
              text: currentText,
            });
          }

          // Save tool_use blocks to assistant message
          for (const toolCall of currentToolCalls) {
            assistantMsg.content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.arguments,
            });
          }

          // Execute all tools
          for (const toolCall of currentToolCalls) {
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
              const toolCallObj: ToolCall = {
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.arguments,
              };
              const result = await toolExecutor(toolCallObj);
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

          // Add tool results to conversation history for next iteration
          // Add assistant message with tool calls
          conversationHistory.push({
            role: 'assistant',
            content: currentText || `Used tools: ${currentToolCalls.map(t => t.name).join(', ')}`,
          });
          
          // Add tool results as user message (Anthropic format)
          const toolResultsText = toolResults.map((r, idx) => {
            const content = typeof r.content === 'string' ? r.content : JSON.stringify(r.content);
            return `Tool ${currentToolCalls[idx].name} result: ${content}`;
          }).join('\n');
          
          conversationHistory.push({
            role: 'user',
            content: toolResultsText,
          });

          // Add messages to conversation
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

          // Reset assistant message for next turn
          assistantMsg.id = `msg_${Date.now() + 3}`;
          assistantMsg.content = [];
          assistantMsg.timestamp = new Date().toISOString();

          // Continue loop
          continueLoop = true;
        } else {
          // No more tools - we're done
          console.log('[NedServiceBaleybots] No more tools, conversation complete');
          continueLoop = false;
        }
      }

      // Add all accumulated text to final assistant message
      if (allTextChunks.length > 0) {
        const fullText = allTextChunks.join('');
        assistantMsg.content.push({ type: 'text', text: fullText });
      }

      // Add final assistant message to conversation
      if (assistantMsg.content.length > 0) {
        conversation.messages.push(assistantMsg);
      }
      conversation.lastActive = new Date().toISOString();

      yield { type: 'complete' };
    } catch (error) {
      console.error('NedBaleybots error:', error);
      throw error;
    }
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
export const nedServiceBaleybots = new NedServiceBaleybots();

