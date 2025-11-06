/**
 * Ned Service - BaleyBots Implementation
 *
 * Uses BaleyBots SDK for LLM calls with automatic tool loops.
 * Tool execution remains in frontend (tools need React state).
 * API calls are routed through Tauri for secure API key management.
 */

import { Baleybot, BaleybotClient, tool } from '@baleybots/core';
import type { Processable, ProcessOptions } from '@baleybots/core';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import type { AppState } from '../types';
import { NED_TOOLS, WRITE_TOOLS, type ToolCall } from './nedTools';
import type {
  NedConversation,
  ToolExecutor,
  PermissionChecker,
} from './nedService';
import { tauri } from './tauriProvider';

export class NedServiceBaleybots {
  private apiKey: string | null = null;
  private conversations: Map<string, NedConversation> = new Map();
  private executors: Map<string, { executor: ToolExecutor; checker: PermissionChecker }> = new Map();

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

  private jsonSchemaToZod(propSchema: Record<string, unknown>, required: boolean = true): z.ZodTypeAny {
    const type = propSchema.type || 'string';
    let zodType: z.ZodTypeAny;
    switch (type) {
      case 'string':
        zodType = propSchema.enum && Array.isArray(propSchema.enum) && propSchema.enum.length > 0
          ? z.enum(propSchema.enum as [string, ...string[]])
          : z.string();
        break;
      case 'number': zodType = z.number(); break;
      case 'boolean': zodType = z.boolean(); break;
      case 'array':
        const itemsSchema = propSchema.items;
        if (itemsSchema && typeof itemsSchema === 'object') {
          zodType = z.array(this.jsonSchemaToZod(itemsSchema as Record<string, unknown>, true));
        } else {
          zodType = z.array(z.string());
        }
        break;
      case 'object':
        if (propSchema.properties && typeof propSchema.properties === 'object') {
          const shape: Record<string, z.ZodTypeAny> = {};
          const objRequired = Array.isArray(propSchema.required) ? propSchema.required as string[] : [];
          for (const [key, value] of Object.entries(propSchema.properties)) {
            if (typeof value === 'object' && value !== null) {
              shape[key] = this.jsonSchemaToZod(value as Record<string, unknown>, objRequired.includes(key));
            }
          }
          zodType = z.object(shape);
        } else {
          zodType = z.record(z.string(), z.unknown());
        }
        break;
      default: zodType = z.unknown();
    }
    if (propSchema.description && typeof propSchema.description === 'string') {
      zodType = zodType.describe(propSchema.description);
    }
    return required ? zodType : zodType.optional();
  }

  /**
   * Create a Processable bot instance for use with useChat
   * Tools are wired to call the provided toolExecutor and permissionChecker
   */
  createBot(
    conversationId: string,
    appState: AppState,
    toolExecutor: ToolExecutor,
    permissionChecker: PermissionChecker
  ): Processable<string, string> {
    if (!this.apiKey) throw new Error('Ned: API key not set');
    
    // Store executors for this conversation
    this.executors.set(conversationId, { executor: toolExecutor, checker: permissionChecker });
    
    // Get or create conversation
    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      const newConvId = this.createConversation();
      conversation = this.conversations.get(newConvId)!;
      // Update conversationId to use the new one
      conversationId = newConvId;
      // Update executors map with new conversation ID
      this.executors.set(conversationId, { executor: toolExecutor, checker: permissionChecker });
    }
    
    const executors = this.executors.get(conversationId);
    if (!executors) throw new Error(`No executors for conversation ${conversationId}`);
    
    // Store conversationId in closure for use in process wrapper
    const finalConversationId = conversationId;

    const tools: Record<string, ReturnType<typeof tool>> = {};
    for (const [toolName, nedTool] of Object.entries(NED_TOOLS)) {
      const shape: Record<string, z.ZodTypeAny> = {};
      const required = Array.isArray(nedTool.input_schema.required) ? nedTool.input_schema.required as string[] : [];
      const properties = (nedTool.input_schema.properties || {}) as Record<string, Record<string, unknown>>;
      for (const propName of Object.keys(properties)) {
        const propSchema = properties[propName];
        if (propSchema && typeof propSchema === 'object') {
          const isRequired = required.includes(propName);
          shape[propName] = this.jsonSchemaToZod(propSchema, isRequired);
        }
      }
      tools[toolName] = tool(toolName, nedTool.description, z.object(shape), async (params: Record<string, unknown>) => {
        if (WRITE_TOOLS.includes(toolName) && !(await executors.checker(toolName))) {
          return { tool_use_id: `temp_${Date.now()}`, content: 'Permission denied', is_error: true };
        }
        try {
          const result = await executors.executor({ id: `tool_${Date.now()}`, name: toolName, input: params });
          return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        } catch (error) {
          return { tool_use_id: `temp_${Date.now()}`, content: `Error: ${error}`, is_error: true };
        }
      });
    }

    const now = new Date();
    const systemPrompt = `<role>You are Ned, a helpful AI assistant for Taskerino.</role>
<context>Date: ${now.toISOString().split('T')[0]}, Time: ${now.toTimeString().split(' ')[0]}, User: ${appState.userProfile.name || 'there'}</context>
<primary_goal>Help users find and manage their tasks, notes, and work sessions efficiently.</primary_goal>
<guidelines>Be concise but friendly. Keep responses under 3 sentences for simple queries. Use code blocks for copyable text.</guidelines>
<tool_usage>**CRITICAL - Large Context Window:** When you use search tools, you receive FULL data. After searching once, you have all the data for follow-up questions. Don't search again for filtering, sorting, or details - only search when you need NEW information.</tool_usage>
${appState.aiSettings.systemInstructions ? `\n<custom_instructions>\n${appState.aiSettings.systemInstructions}\n</custom_instructions>` : ''}`;

    // Create bot with tools - use Tauri provider for secure API key management and streaming
    const bot = Baleybot.create({
      name: 'ned-assistant',
      goal: systemPrompt,
      tools,
      maxToolIterations: 10,
      model: tauri('anthropic', 'claude-sonnet-4-5-20250929'),
      apiKey: this.apiKey || '',
    }) as ReturnType<typeof Baleybot.create>;

    // Return Processable - let useChat handle conversation history
    return {
      process: async (input: string, options?: ProcessOptions) => {
        // Log streaming configuration and wrap onToken to see what events are emitted
        if (options?.onToken) {
          console.log('[NedServiceBaleybots] Streaming enabled - onToken callback provided', typeof options.onToken);
          
          // Wrap onToken to log streaming events
          // onToken can be either a function or TokenHandlers object
          if (typeof options.onToken === 'function') {
            const originalOnToken = options.onToken;
            options.onToken = (botName: string, event: any) => {
              console.log('[NedServiceBaleybots] Streaming event received:', event.type, event);
              
              // Log tool call events specifically with full structure
              if (event.type && String(event.type).includes('tool_call')) {
                console.log('[NedServiceBaleybots] Tool call event detected:', event.type);
                console.log('[NedServiceBaleybots] Tool call event full structure:', JSON.stringify(event, null, 2));
              }
              
              // Log full error message if it's an error event
              if (event.type === 'error') {
                const errorMsg = event.error?.message || 'Unknown error';
                console.error('[NedServiceBaleybots] Error details:', errorMsg);
                // Also log the full error structure
                console.error('[NedServiceBaleybots] Full error event:', JSON.stringify(event, null, 2));
              }
              
              // Call original callback
              originalOnToken(botName, event);
            };
          } else {
            // TokenHandlers object - log that we have handlers
            console.log('[NedServiceBaleybots] TokenHandlers object provided:', Object.keys(options.onToken));
          }
        }
        
        // Process with bot - CRITICAL: Pass options through to enable streaming
        // The options contain onToken callback that useChat uses for streaming
        // This forwards streaming events (text_delta, tool_call_stream_start, etc.) to useChat
        const result = await bot.process(input, options);
        console.log('[NedServiceBaleybots] Bot process complete');
        
        // Extract response text - handle different return formats
        // Baleybot might return: string, { response: string }, { message: string }, or complex object
        let responseText: string;
        if (typeof result === 'string') {
          responseText = result;
        } else if (result && typeof result === 'object') {
          // Try to extract from various possible structures
          const resultObj = result as Record<string, unknown>;
          responseText = (resultObj.response as string) || 
                        (resultObj.message as string) || 
                        (resultObj.text as string) ||
                        (typeof resultObj.content === 'string' ? resultObj.content : '') ||
                        JSON.stringify(result);
          console.log('[NedServiceBaleybots] Extracted response text:', responseText.substring(0, 100));
        } else {
          responseText = String(result || '');
        }

        if (!responseText) {
          console.warn('[NedServiceBaleybots] Empty response text from bot.process()');
        }

        return responseText;
      },
    } as Processable<string, string>;
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
