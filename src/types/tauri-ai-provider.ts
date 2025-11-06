import type { ChatCompletionParams, ChatCompletionResult, StreamEvent, ProviderConfig } from '@baleybots/core';

export type TauriProviderType = 'anthropic' | 'openai' | 'google' | 'ollama';

// Minimal wrapper for Tauri command - provider type is added at call site
export interface TauriChatCompletionRequest {
  providerType: TauriProviderType;
  model: string;
  // Use baleybots ChatCompletionParams directly - no need to redefine
  params: ChatCompletionParams;
  // ProviderConfig includes API key (but we'll override with Tauri secure storage)
  config: ProviderConfig;
}

// Tauri stream event - wraps baleybots StreamEvent with streamId for event routing
export interface TauriStreamEventPayload {
  streamId: string;
  // Use baleybots StreamEvent directly - proper discriminated union
  event: StreamEvent;
}

// Tauri command response for streaming start
export interface TauriStreamStartResponse {
  streamId: string;
  success: boolean;
  error?: string;
}

