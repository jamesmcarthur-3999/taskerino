/**
 * Tauri Provider for Baleybots
 * 
 * Wraps other providers (anthropic, openai, google, ollama) and routes all HTTP calls
 * through the Tauri backend for secure API key management and native streaming support.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { 
  ChatCompletionParams, 
  ChatCompletionResult, 
  StreamEvent,
  ModelProvider,
  ProviderConfig,
  ProviderModel,
} from '@baleybots/core';
import { registerProvider, getProvider as getBaleybotProvider } from '@baleybots/core';
// StreamEventCallback is not exported from main entry point, define it locally
type StreamEventCallback = (event: StreamEvent) => void | Promise<void>;
import type {
  TauriProviderType,
  TauriChatCompletionRequest,
  TauriStreamEventPayload,
  TauriStreamStartResponse,
} from '../types/tauri-ai-provider';

/**
 * Tauri ModelProvider implementation
 * Routes all HTTP calls through Tauri backend for secure API key management
 */
class TauriModelProvider implements ModelProvider {
  readonly name: string;
  private providerType: TauriProviderType;
  private model: string;

  constructor(providerType: TauriProviderType, model: string) {
    this.providerType = providerType;
    this.model = model;
    this.name = `tauri-${providerType}`;
  }

  async chatCompletion(
    params: ChatCompletionParams,
    config: ProviderConfig
  ): Promise<ChatCompletionResult> {
      // Build request - pass params and config directly
      const request: TauriChatCompletionRequest = {
        providerType: this.providerType,
        model: this.model,
        params,  // Pass ChatCompletionParams directly
        config,  // Pass ProviderConfig directly (API key will be injected in Rust)
      };

      // Call Tauri command - Tauri uses baleybots providers via bridge script
      const responseText = await invoke<string>('tauri_ai_chat_completion', {
        request,
      });

      // Parse response as ChatCompletionResult
      const result: ChatCompletionResult = JSON.parse(responseText);
      return result;
  }

  async chatCompletionStream(
    params: ChatCompletionParams,
    config: ProviderConfig,
    onEvent: StreamEventCallback
  ): Promise<ChatCompletionResult> {
      // Build request - pass params and config directly
      // Note: API key in config will be overridden by Tauri secure storage
      const request: TauriChatCompletionRequest = {
        providerType: this.providerType,
        model: this.model,
        params,  // Pass ChatCompletionParams directly
        config,  // Pass ProviderConfig directly (API key will be injected in Rust)
      };

      // Start streaming - Tauri uses baleybots providers via bridge script
      const streamStart: TauriStreamStartResponse = await invoke('tauri_ai_chat_completion_stream_start', {
        request,
      });

      if (!streamStart.success) {
        throw new Error(streamStart.error || 'Failed to start stream');
      }

      const streamId = streamStart.streamId;
      const eventName = `tauri-stream-event-${streamId}`;

      console.log('[TauriProvider] Starting stream, streamId:', streamId);
      console.log('[TauriProvider] Listening for events on:', eventName);

      // Track completion state
      let completed = false;
      let finalResult: ChatCompletionResult | null = null;
      let accumulatedContent = '';
      let accumulatedToolCalls: any[] = [];

      // Listen to Tauri events
      const unlisten = await listen<TauriStreamEventPayload>(eventName, (event) => {
        console.log('[TauriProvider] Received event:', event);
        const payload = event.payload;
        
        // Extract baleybots StreamEvent from payload
        const streamEvent: StreamEvent = payload.event as StreamEvent;
        const eventType = (streamEvent as any).type;
        console.log('[TauriProvider] Stream event type:', eventType);
        
        // Log all event types for diagnostics (not just tool calls)
        if (eventType) {
          console.log('[TauriProvider] Event type:', eventType);
          // Log full structure for non-text events to see what we're getting
          if (eventType !== 'text_delta') {
            console.log('[TauriProvider] Non-text event structure:', JSON.stringify(streamEvent, null, 2));
          }
        }
        
        // Log tool call events specifically with full structure
        if (eventType && String(eventType).includes('tool_call')) {
          console.log('[TauriProvider] Tool call event detected:', eventType);
          console.log('[TauriProvider] Tool call event full structure:', JSON.stringify(streamEvent, null, 2));
        }
        
        // Also check for content_block events that might contain tool calls
        if (eventType && (String(eventType).includes('content_block') || String(eventType).includes('tool'))) {
          console.log('[TauriProvider] Potential tool-related event:', eventType);
          console.log('[TauriProvider] Event structure:', JSON.stringify(streamEvent, null, 2));
        }
        
        // Log full error message if it's an error event
        if (streamEvent.type === 'error') {
          const errorMsg = (streamEvent as any).error?.message || 'Unknown error';
          console.error('[TauriProvider] Stream error:', errorMsg);
          // Also log the full event structure for debugging
          console.error('[TauriProvider] Full error event:', JSON.stringify(streamEvent, null, 2));
        }
        
        // Call onEvent callback with baleybots event
        onEvent(streamEvent);

        // Track completion
        if (streamEvent.type === 'text_delta') {
          accumulatedContent += (streamEvent as any).content || '';
        } else if ((streamEvent as any).type === 'tool_call_stream_start') {
          accumulatedToolCalls.push({
            id: (streamEvent as any).id,
            toolName: (streamEvent as any).toolName,
            arguments: '',
          });
        } else if ((streamEvent as any).type === 'tool_call_arguments_delta') {
          const toolCall = accumulatedToolCalls.find(tc => tc.id === (streamEvent as any).id);
          if (toolCall) {
            toolCall.arguments += (streamEvent as any).argumentsDelta || '';
          }
        } else if ((streamEvent as any).type === 'tool_call_stream_complete') {
          const toolCall = accumulatedToolCalls.find(tc => tc.id === (streamEvent as any).id);
          if (toolCall) {
            try {
              toolCall.arguments = JSON.parse(toolCall.arguments || '{}');
            } catch (e) {
              // Invalid JSON - keep as string
            }
          }
        } else if ((streamEvent as any).type === 'message_stop' || (streamEvent as any).type === 'error') {
          // Stream complete
          completed = true;
        }
      });

      // Wait for stream to complete
      return new Promise<ChatCompletionResult>((resolve, reject) => {
        // Check completion every 100ms
        const checkInterval = setInterval(() => {
          if (completed) {
            clearInterval(checkInterval);
            unlisten();
            
            // Build final result
            finalResult = {
              content: accumulatedContent,
              toolCalls: accumulatedToolCalls.map(tc => ({
                id: tc.id,
                name: tc.toolName,
                arguments: tc.arguments,
              })),
            };
            resolve(finalResult!);
          }
        }, 100);

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!completed) {
            clearInterval(checkInterval);
            unlisten();
            reject(new Error('Stream timeout'));
          }
        }, 5 * 60 * 1000);
      });
  }
}

/**
 * Create a Tauri provider that wraps other providers and routes HTTP calls through Tauri
 * 
 * @param providerType - Type of provider to wrap (anthropic, openai, google, ollama)
 * @param model - Model name (e.g., 'claude-sonnet-4-5-20250929')
 * @returns ProviderModel compatible with Baleybot.create()
 */
export function tauri(
  providerType: TauriProviderType,
  model: string
): ProviderModel {
  // Register provider if not already registered
  const providerName = `tauri-${providerType}`;
  if (!getProvider(providerName)) {
    registerProvider(providerName, new TauriModelProvider(providerType, model));
  }

  return {
    provider: providerName,
    modelId: model,
    config: {},
  };
}

// Helper to check if provider exists (will throw if not found)
function getProvider(name: string): ModelProvider | undefined {
  try {
    return getBaleybotProvider(name);
  } catch {
    return undefined;
  }
}

